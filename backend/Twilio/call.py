import logging
import os
import json
from groq import Groq
from dotenv import load_dotenv
from fastapi.websockets import WebSocketDisconnect
from fastapi import WebSocket
import base64
import io
from app_init import app
from datetime import datetime
from pydub import AudioSegment

# Load environment variables
load_dotenv()

# Constants
ORIGINAL_SAMPLE_RATE = 8000  # Twilio audio
TARGET_SAMPLE_RATE = 16000   # What Whisper expects
CHUNK_DURATION = 3.0        # Seconds of audio to buffer before transcribing

# Init Groq Whisper client
client = Groq(
    api_key=os.environ.get("GROQ_API_KEY"),
)

@app.websocket("/process_stream")
async def process_stream(websocket: WebSocket):
    await websocket.accept()
    audio_buffer = bytearray()
    full_transcript = ""

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
                        model="distil-whisper-large-v3-en",
                        response_format="text"
                    )

                    # Clean & append transcription if not empty
                    transcribed_text = transcription.strip()
                    if transcribed_text:
                        full_transcript += " " + transcribed_text
                        await websocket.send_text(json.dumps({
                            "event": "media",
                            "text": full_transcript.strip()
                        }))
                        logging.info(f"[✓] Transcribed: {transcribed_text}")
                    else:
                        logging.warning("[!] Transcription returned empty.")

                    # Clear buffer for next chunk
                    audio_buffer.clear()

    except WebSocketDisconnect:
        logging.info("WebSocket client disconnected.")
    except Exception as e:
        logging.error(f"[!] Error in /process_stream: {e}")