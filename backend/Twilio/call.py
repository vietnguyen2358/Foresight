import httpx
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
            message = await websocket.receive_text()
            data = json.loads(message)

            if data['event'] == 'media':
                chunk = base64.b64decode(data['media']['payload'])
                audio_buffer.extend(chunk)

                if len(audio_buffer) >= int(ORIGINAL_SAMPLE_RATE * CHUNK_DURATION):
                    ulaw_audio = AudioSegment(
                        data=audio_buffer,
                        sample_width=1,
                        frame_rate=ORIGINAL_SAMPLE_RATE,
                        channels=1
                    ).set_sample_width(2).set_frame_rate(TARGET_SAMPLE_RATE)

                    wav_buffer = io.BytesIO()
                    ulaw_audio.export(wav_buffer, format="wav")
                    wav_buffer.seek(0)

                    transcription = client.audio.transcriptions.create(
                        file=("audio.wav", wav_buffer, "audio/wav"),
                        model="distil-whisper-large-v3-en",
                        response_format="text"
                    )

                    transcribed_text = transcription.strip()
                    if transcribed_text:
                        full_transcript += " " + transcribed_text

                        # ✅ Send the transcribed text to /search
                        async with httpx.AsyncClient() as http_client:
                            response = await http_client.post(
                                "http://localhost:8000/search",
                                data={"query": full_transcript.strip()}
                            )
                            search_results = response.json()

                        # Send both transcript and search results back to WebSocket
                        await websocket.send_text(json.dumps({
                            "event": "media",
                            "text": full_transcript.strip(),
                            "search_results": search_results
                        }))
                        logging.info(
                            f"[✓] Transcribed and searched: {transcribed_text}")
                    else:
                        logging.warning("[!] Transcription returned empty.")

                    audio_buffer.clear()
    except WebSocketDisconnect:
        logging.info("WebSocket client disconnected.")
    except Exception as e:
        logging.error(f"[!] Error in /process_stream: {e}")


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()

            # Acquire lock to block other tasks until this completes
            async with ws_lock:
                # Process WebSocket command
                await websocket.send_text(f"Processing: {data}")

                # Simulate an API call that must finish first
                await some_async_api_call(data)  # Ensure this is awaited!

    except Exception as e:
        print(f"Error: {e}")
    finally:
        print("Connection closed")
