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
MAX_MESSAGE_SIZE = 65536    # Maximum WebSocket message size (64KB)

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
    processing = False  # Flag to track if we're currently processing audio
    connection_active = True  # Flag to track if the connection is still active

    try:
        # Send an initial message to verify the connection
        try:
            await websocket.send_text(json.dumps({
                "event": "connected",
                "message": "WebSocket connection established"
            }))
            logging.info("Sent connection verification message")
        except Exception as e:
            logging.error(f"Failed to send connection verification: {e}")
            connection_active = False
            return

        while connection_active:
            try:
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

                        # Process once we have enough audio and we're not already processing
                        if len(audio_buffer) >= int(ORIGINAL_SAMPLE_RATE * CHUNK_DURATION) and not processing:
                            # Set processing flag to prevent concurrent processing
                            processing = True
                            
                            # Use the lock to ensure only one transcription process runs at a time
                            async with ws_lock:
                                try:
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
                                    logging.info("Sending audio to Groq Whisper for transcription")
                                    transcription = client.audio.transcriptions.create(
                                        file=("audio.wav", wav_buffer, "audio/wav"),
                                        model="distil-whisper-large-v3-en",
                                        response_format="text"
                                    )
                                    logging.info("Received transcription from Groq Whisper")

                                    # Clean & append transcription if not empty
                                    transcribed_text = transcription.strip()
                                    if transcribed_text:
                                        full_transcript += " " + transcribed_text
                                        logging.info(f"Updated full transcript: {full_transcript[:100]}...")

                                        # Send the transcribed text to /search
                                        logging.info("Sending transcript to search API")
                                        async with httpx.AsyncClient() as http_client:
                                            response = await http_client.post(
                                                "http://localhost:8000/search",
                                                data={"query": full_transcript.strip()}
                                            )
                                            search_results = response.json()
                                            logging.info("Received search results")

                                        # Prepare the message to send
                                        message_data = {
                                            "event": "media",
                                            "text": full_transcript.strip(),
                                            "search_results": search_results
                                        }
                                        
                                        # Convert to JSON and check size
                                        message_to_send = json.dumps(message_data)
                                        message_size = len(message_to_send.encode('utf-8'))
                                        
                                        if message_size > MAX_MESSAGE_SIZE:
                                            logging.warning(f"Message too large ({message_size} bytes), truncating search results")
                                            # Truncate search results if message is too large
                                            if "matches" in search_results:
                                                search_results["matches"] = search_results["matches"][:5]  # Keep only first 5 matches
                                            message_data["search_results"] = search_results
                                            message_to_send = json.dumps(message_data)
                                        
                                        # Send the message with explicit error handling
                                        try:
                                            logging.info(f"Sending WebSocket message ({len(message_to_send)} bytes)")
                                            await websocket.send_text(message_to_send)
                                            logging.info("WebSocket message sent successfully")
                                        except Exception as send_error:
                                            logging.error(f"Failed to send WebSocket message: {send_error}")
                                            connection_active = False
                                            break
                                            
                                        logging.info(f"[✓] Transcribed and searched: {transcribed_text}")
                                    else:
                                        logging.warning("[!] Transcription returned empty.")

                                    # Clear buffer for next chunk
                                    audio_buffer.clear()
                                    logging.debug("Audio buffer cleared")
                                except Exception as e:
                                    logging.error(f"Error during transcription process: {e}")
                                    # Try to send an error message to the client
                                    try:
                                        await websocket.send_text(json.dumps({
                                            "event": "error",
                                            "message": f"Error during transcription: {str(e)}"
                                        }))
                                    except:
                                        logging.error("Failed to send error message to client")
                                finally:
                                    # Reset processing flag when done
                                    processing = False
                    except base64.binascii.Error as e:
                        logging.error(f"Failed to decode base64 audio data: {e}")
                    except Exception as e:
                        logging.error(f"Error processing audio chunk: {e}")
                        processing = False  # Reset processing flag on error
                else:
                    logging.warning(f"Received unknown event type: {data.get('event')}")
            except WebSocketDisconnect:
                logging.info("WebSocket client disconnected.")
                connection_active = False
                break
            except Exception as e:
                logging.error(f"Error in WebSocket loop: {e}")
                connection_active = False
                break

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
    finally:
        logging.info("WebSocket connection closed")


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
