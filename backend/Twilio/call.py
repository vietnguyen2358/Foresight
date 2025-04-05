import os
import json
from groq import Groq
from dotenv import load_dotenv
from fastapi.websockets import WebSocketDisconnect
from fastapi import WebSocket
import websockets

load_dotenv()

client = Groq(
    api_key=os.environ.get("GROQ_API_KEY"),
)

@app.websocket("/stream")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    try:
        while True:
        # Receive message from client
            data = await websocket.receive_text()
            
            # Create chat completion with streaming
            chat_completion = client.chat.completions.create(
                messages=[
                    {
                        "role": "user",
                        "content": data,
                    }
                ],
                model="whisper-large-v3-turbo",
                stream=True,
                temperature=0.7,
            )

            # Stream the responses back to the websocket
            for chunk in chat_completion:
                if chunk.choices[0].delta.content is not None:
                    await websocket.send_text(chunk.choices[0].delta.content)
                    
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"Error: {str(e)}")
        await websocket.close()
