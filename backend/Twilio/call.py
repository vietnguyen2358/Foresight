import logging
import os
import json
from groq import Groq
from dotenv import load_dotenv
from fastapi.websockets import WebSocketDisconnect
from fastapi import WebSocket
import base64
import io
import uvicorn

from pydub import AudioSegment
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from twilio.twiml.voice_response import VoiceResponse, Connect

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
ORIGINAL_SAMPLE_RATE = 8000  # Twilio audio
TARGET_SAMPLE_RATE = 16000   # What Whisper expects
CHUNK_DURATION = 3.0        # Seconds of audio to buffer before transcribing
TRANSCRIPTION_FILE = "transcription.txt"  # File to store transcription data

# Init Groq Whisper client
client = Groq(
    api_key=os.environ.get("GROQ_API_KEY"),
)

app = FastAPI(title="Twilio Transcription")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# Function to write transcription to file
def write_transcription_to_file(transcription, search_results=None):
    try:
        data = {
            "transcription": transcription,
            "search_results": search_results
        }
        with open(TRANSCRIPTION_FILE, "w") as f:
            json.dump(data, f)
        logger.info(f"Successfully wrote transcription to {TRANSCRIPTION_FILE}")
    except Exception as e:
        logger.error(f"Error writing to transcription file: {e}")

@app.api_route("/incoming_call", methods=["GET", "POST"])
async def handle_incoming_call(request: Request):
    """Handle incoming call and return TwiML response to connect to Media Stream."""
    response = VoiceResponse()
    # <Say> punctuation to improve text-to-speech flow
    response.say("Please wait while we connect your call.")
    response.pause(length=1)
    response.say("O.K. you can start talking!")
    
    # Get the host and determine the protocol
    host = request.url.hostname
    scheme = request.url.scheme
    ws_protocol = "wss" if scheme == "https" else "ws"
    ws_url = f"{ws_protocol}://{host}/process_stream"
    
    logger.info(f"WebSocket URL: {ws_url}")
    
    connect = Connect()
    connect.stream(url=ws_url)
    response.append(connect)
    return HTMLResponse(content=str(response), media_type="application/xml")

@app.websocket("/process_stream")
async def process_stream(websocket: WebSocket):
    await websocket.accept()
    audio_buffer = bytearray()
    full_transcript = ""
    
    # Clear the transcription file at the start of a new call
    write_transcription_to_file("")
    
    # Send a connection verification message
    try:
        await websocket.send_text(json.dumps({
            "event": "status",
            "message": "Connected to transcription service"
        }))
        logger.info("Sent connection verification message")
    except Exception as e:
        logger.error(f"Error sending connection verification: {e}")

    try:
        while True:
            # Receive and parse media chunk
            message = await websocket.receive_text()
            data = json.loads(message)

            if data['event'] == 'media':
                # Decode base64-encoded μ-law audio from Twilio
                chunk = base64.b64decode(data['media']['payload'])
                audio_buffer.extend(chunk)

                # Process once we have enough audio
                if len(audio_buffer) >= int(ORIGINAL_SAMPLE_RATE * CHUNK_DURATION):
                    # Convert μ-law to PCM and resample to 16kHz using pydub
                    ulaw_audio = AudioSegment(
                        data=audio_buffer,
                        sample_width=1,
                        frame_rate=ORIGINAL_SAMPLE_RATE,
                        channels=1
                    ).set_sample_width(2).set_frame_rate(TARGET_SAMPLE_RATE)

                    # Export audio as in-memory WAV
                    wav_buffer = io.BytesIO()
                    ulaw_audio.export(wav_buffer, format="wav")
                    wav_buffer.seek(0)

                    # Transcribe using Groq's Whisper (distil-whisper-large-v3-en)
                    transcription = client.audio.transcriptions.create(
                        file=("audio.wav", wav_buffer, "audio/wav"),
                        model="whisper-large-v3-turbo",
                        response_format="text"
                    )

                    # Clean & append transcription if not empty
                    transcribed_text = transcription.strip()
                    if transcribed_text:
                        full_transcript += " " + transcribed_text
                        full_transcript = full_transcript.strip()
                        
                        # Write transcription to file
                        write_transcription_to_file(full_transcript)
                        
                        # Send a status update via WebSocket
                        await websocket.send_text(json.dumps({
                            "event": "status",
                            "message": "Transcription updated"
                        }))
                        
                        logger.info(f"[✓] Transcribed: {transcribed_text}")
                    else:
                        logger.warning("[!] Transcription returned empty.")

                    # Clear buffer for next chunk
                    audio_buffer.clear()

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected.")
    except Exception as e:
        logger.error(f"[!] Error in /process_stream: {e}")

@app.get("/transcription")
async def get_transcription():
     """Get the current transcription from the file."""
     try:
         # Check if the file exists
         if not os.path.exists("transcription.txt"):
             return {"transcription": "", "search_results": {}, "timestamp": 0}
         
         # Read the file
         with open("transcription.txt", "r") as f:
             data = json.load(f)
         
         return data
     except Exception as e:
         logging.error(f"Error reading transcription file: {e}")
         return {"transcription": "", "search_results": {}, "timestamp": 0, "error": str(e)}



if __name__ == "__main__":
    logger.info("Starting server...")
    uvicorn.run("call:app", host="0.0.0.0", port=8000, reload=True)