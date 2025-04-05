# SFHacks Backend

This is the backend service for the SFHacks project, which provides person detection, tracking, and search functionality.

## Setup Instructions

### Prerequisites

- Python 3.8 or higher
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/vietnguyen2358/SFHacks.git
   cd SFHacks/backend
   ```

2. Create and activate a virtual environment:
   ```bash
   # On macOS/Linux
   python -m venv venv
   source venv/bin/activate
   
   # On Windows
   python -m venv venv
   venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create a `.env` file with your API keys:
   ```
   # API Keys
   # Get your Gemini API key from: https://makersuite.google.com/app/apikey
   GEMINI_API_KEY=your_gemini_api_key_here
   
   # Optional Configuration
   DEVICE=cpu  # Force CPU usage for YOLO model
   ```

5. Download the YOLO model (this will happen automatically on first run, but you can pre-download it):
   ```bash
   python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"
   ```

### Running the Server

Start the server with:
```bash
python main.py
```

The server will run on `http://localhost:8000`.

## API Endpoints

### Upload Endpoint
- **URL**: `/upload`
- **Method**: POST
- **Description**: Upload an image or video to detect and track people
- **Parameters**:
  - `file`: The image or video file to upload
  - `is_video`: Boolean indicating if the file is a video (default: False)

### Search Endpoint
- **URL**: `/search`
- **Method**: POST
- **Description**: Search for people based on a text description
- **Parameters**:
  - `query`: Text description of the person to search for

## Project Structure

- `main.py`: FastAPI application and endpoints
- `tracker.py`: Person detection and tracking functionality
- `embedder.py`: Text and image embedding using Gemini
- `db.py`: Database operations for storing person data
- `search.py`: Search functionality for finding similar people

## Troubleshooting

- If you encounter CUDA errors, make sure to set `DEVICE=cpu` in your `.env` file
- For memory issues with large videos, try processing shorter clips
- If the server fails to start, check that all dependencies are installed correctly 