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
import asyncio

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

# Create a lock for WebSocket operations
ws_lock = asyncio.Lock()

@app.websocket("/process_stream")
async def process_stream(websocket: WebSocket):
    logging.info("New WebSocket connection request received")
    await websocket.accept()
    logging.info("WebSocket connection accepted")
    audio_buffer = bytearray()
    full_transcript = ""

    try:
        while True:
            # Receive and parse media chunk
            message = await websocket.receive_text()
            logging.debug(f"Received WebSocket message: {message[:100]}...")  # Log first 100 chars
            
            try:
                data = json.loads(message)
            except json.JSONDecodeError as e:
                logging.error(f"Failed to parse WebSocket message as JSON: {e}")
                continue

            if data['event'] == 'media':
                try:
                    # Decode base64-encoded μ-law audio from Twilio
                    chunk = base64.b64decode(data['media']['payload'])
                    audio_buffer.extend(chunk)
                    logging.debug(f"Added {len(chunk)} bytes to audio buffer. Total size: {len(audio_buffer)}")

                    # Process once we have enough audio
                    if len(audio_buffer) >= int(ORIGINAL_SAMPLE_RATE * CHUNK_DURATION):
                        logging.info("Processing audio chunk for transcription")
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

                        # Transcribe using Groq's Whisper
                        transcription = client.audio.transcriptions.create(
                            file=("audio.wav", wav_buffer, "audio/wav"),
                            model="distil-whisper-large-v3-en",
                            response_format="text"
                        )

                        # Clean & append transcription if not empty
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

                        # Clear buffer for next chunk
                        audio_buffer.clear()
                        logging.debug("Audio buffer cleared")
                except base64.binascii.Error as e:
                    logging.error(f"Failed to decode base64 audio data: {e}")
                except Exception as e:
                    logging.error(f"Error processing audio chunk: {e}")
            else:
                logging.warning(f"Received unknown event type: {data.get('event')}")

    except WebSocketDisconnect:
        logging.info("WebSocket client disconnected.")
    except Exception as e:
        logging.error(f"[!] Error in /process_stream: {e}")
        try:
            await websocket.send_text(json.dumps({
                "event": "error",
                "message": "An error occurred while processing the audio stream"
            }))
        except:
            logging.error("Failed to send error message to client")


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
                await asyncio.sleep(1)  # Replace with actual API call

    except Exception as e:
        print(f"Error: {e}")
    finally:
        print("Connection closed")
