# Pet Portrait Generator API Reference

This document provides detailed technical specifications for integrating with the Pet Portrait Generator API.

## Base URL

```
http://localhost:3000
```

Replace with your production server URL when deploying.

## Authentication

Currently, the API does not require authentication. Session-based tracking is used to manage portrait generation.

## API Endpoints

### Health Check

Check if the API is running.

```
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "message": "Pet Portrait Generator API is running"
}
```

### Upload Image

Upload a pet image to generate a portrait.

```
POST /api/upload
```

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `image`: Image file (JPEG, PNG, etc.)

**Response:**
```json
{
  "success": true,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Image uploaded successfully",
  "imageUrl": "/api/images/filename.png?type=input&subfolder="
}
```

**Error Responses:**
- 400 Bad Request: No image file provided or invalid file type
- 500 Internal Server Error: Failed to upload image to ComfyUI

### Generate Portrait

Generate a portrait from an uploaded image.

```
POST /api/generate
```

**Request:**
- Content-Type: `application/json`
- Body:
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "userInputs": {
    "229": "dog"
  }
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "promptId": "prompt-id-from-comfyui",
  "message": "Portrait generation started",
  "wsEndpoint": "/ws?clientId=pet-portrait-550e8400-e29b-41d4-a716-446655440000",
  "totalNodes": 42
}
```

**Error Responses:**
- 400 Bad Request: Invalid or expired session ID
- 500 Internal Server Error: Workflow data not loaded or failed to queue prompt

### Check Status

Check the status of a portrait generation.

```
GET /api/status/:sessionId
```

**Parameters:**
- `sessionId`: The session ID returned from the upload endpoint

**Response:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "progress": 45,
  "currentNode": "node-id",
  "currentNodeInfo": {
    "id": "node-id",
    "type": "KSampler",
    "title": "KSampler Node"
  },
  "message": "Processing: KSampler",
  "resultImage": null,
  "startTime": "2023-06-15T12:34:56.789Z",
  "endTime": null,
  "executedNodesCount": 5,
  "totalNodes": 42
}
```

When processing is complete:
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "progress": 100,
  "currentNode": null,
  "currentNodeInfo": null,
  "message": "Portrait completed",
  "resultImage": "/api/images/output_filename.png?type=output&subfolder=",
  "startTime": "2023-06-15T12:34:56.789Z",
  "endTime": "2023-06-15T12:36:56.789Z",
  "executedNodesCount": 42,
  "totalNodes": 42
}
```

**Error Responses:**
- 404 Not Found: Session not found
- 500 Internal Server Error: Error getting session status

### Regenerate Portrait

Regenerate a portrait with different random seeds.

```
POST /api/regenerate
```

**Request:**
- Content-Type: `application/json`
- Body:
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "userInputs": {
    "229": "cat"
  }
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "promptId": "new-prompt-id-from-comfyui",
  "message": "Portrait regeneration started",
  "wsEndpoint": "/ws?clientId=pet-portrait-550e8400-e29b-41d4-a716-446655440000",
  "totalNodes": 42
}
```

**Error Responses:**
- 400 Bad Request: Invalid or expired session ID
- 500 Internal Server Error: Workflow data not loaded or failed to queue prompt

### Get Workflow Info

Get information about the workflow used for portrait generation.

```
GET /api/workflow-info
```

Returns information about the current workflow, including aspect ratio, required user inputs, and node types.

**Response Format:**
```json
{
  "totalNodes": 50,
  "aspectRatio": {
    "width": 832,
    "height": 1216
  },
  "userInputs": [
    {
      "nodeId": "229",
      "type": "text",
      "title": "Pet Type Input",
      "description": "Enter the type of pet (e.g., dog, cat, bird)",
      "defaultValue": "dog"
    }
  ],
  "nodeTypes": [
    {
      "id": "229",
      "type": "CLIPTextEncode",
      "title": "Pet Type Input"
    }
    // ... other nodes
  ]
}
```

**Error Responses:**
- 500 Internal Server Error: Workflow data not loaded

### Get Image

Get an image (input or output).

```
GET /api/images/:filename
```

**Parameters:**
- `filename`: The filename of the image

**Query Parameters:**
- `type`: Image type (`input` or `output`, default: `output`)
- `subfolder`: Subfolder in ComfyUI (default: `""`)

**Response:**
- Content-Type: `image/png` or appropriate image MIME type
- Body: Binary image data

**Error Responses:**
- 500 Internal Server Error: Failed to fetch image

## WebSocket API

Connect to the WebSocket endpoint for real-time updates on portrait generation progress.

```
WebSocket /ws?clientId=pet-portrait-550e8400-e29b-41d4-a716-446655440000
```

### Message Types

#### Progress Update

Basic progress update for a node.

```json
{
  "type": "progress",
  "data": {
    "id": "prompt-id-from-comfyui",
    "value": 0.5
  }
}
```

#### Detailed Progress Update

Detailed progress update with node information and execution counts.

```json
{
  "type": "detailed_progress",
  "data": {
    "progress": 45,
    "currentNode": "node-id",
    "nodeInfo": {
      "id": "node-id",
      "type": "KSampler",
      "title": "KSampler Node"
    },
    "executedNodesCount": 5,
    "totalNodes": 42
  }
}
```

#### Node Execution

```json
{
  "type": "executing",
  "data": {
    "prompt_id": "prompt-id-from-comfyui",
    "node": "node-id"
  }
}
```

#### Execution Complete

```json
{
  "type": "executing",
  "data": {
    "prompt_id": "prompt-id-from-comfyui",
    "node": null
  }
}
```

#### Result Available

```json
{
  "type": "result",
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "resultImage": "/api/images/output_filename.png?type=output&subfolder=",
    "executedNodesCount": 42,
    "totalNodes": 42
  }
}
```

## Integration Examples

### JavaScript/TypeScript

```typescript
// Types for API responses
interface UploadResponse {
  success: boolean;
  sessionId: string;
  message: string;
  imageUrl: string;
}

interface GenerateResponse {
  success: boolean;
  sessionId: string;
  promptId: string;
  message: string;
  wsEndpoint: string;
  totalNodes: number;
}

interface NodeInfo {
  id: string;
  type: string;
  title: string;
}

interface StatusResponse {
  sessionId: string;
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  progress: number;
  currentNode: string | null;
  currentNodeInfo: NodeInfo | null;
  message: string;
  resultImage: string | null;
  startTime: string;
  endTime: string | null;
  executedNodesCount: number;
  totalNodes: number;
}

interface WorkflowInfoResponse {
  nodeCount: number;
  nodeTypes: Record<string, number>;
  executionOrderLength: number;
}

// Upload an image
async function uploadImage(imageFile: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('image', imageFile);

  const response = await fetch('http://localhost:3000/api/upload', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to upload image');
  }

  return await response.json();
}

// Generate a portrait
async function generatePortrait(sessionId: string): Promise<GenerateResponse> {
  const response = await fetch('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sessionId })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to generate portrait');
  }

  return await response.json();
}

// Check status
async function checkStatus(sessionId: string): Promise<StatusResponse> {
  const response = await fetch(`http://localhost:3000/api/status/${sessionId}`);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to check status');
  }

  return await response.json();
}

// Get workflow info
async function getWorkflowInfo(): Promise<WorkflowInfoResponse> {
  const response = await fetch('http://localhost:3000/api/workflow-info');

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to get workflow info');
  }

  return await response.json();
}

// Connect to WebSocket for real-time updates
function connectWebSocket(clientId: string, callbacks: {
  onProgress?: (progress: number) => void;
  onDetailedProgress?: (data: {
    progress: number;
    currentNode: string;
    nodeInfo: NodeInfo;
    executedNodesCount: number;
    totalNodes: number;
  }) => void;
  onNodeExecution?: (nodeId: string) => void;
  onComplete?: () => void;
  onResult?: (imageUrl: string) => void;
}): WebSocket {
  const ws = new WebSocket(`ws://localhost:3000/ws?clientId=${clientId}`);

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
      case 'progress':
        if (callbacks.onProgress && message.data.id) {
          // Map progress from 0-1 to 0-100
          const progress = message.data.value * 100;
          callbacks.onProgress(progress);
        }
        break;
      case 'detailed_progress':
        if (callbacks.onDetailedProgress) {
          callbacks.onDetailedProgress(message.data);
        }
        break;
      case 'executing':
        if (message.data.node === null) {
          // Execution completed
          if (callbacks.onComplete) {
            callbacks.onComplete();
          }
        } else if (callbacks.onNodeExecution) {
          callbacks.onNodeExecution(message.data.node);
        }
        break;
      case 'result':
        if (callbacks.onResult && message.data.resultImage) {
          callbacks.onResult(message.data.resultImage);
        }
        break;
    }
  };

  return ws;
}

// Full example usage with detailed progress tracking
async function generatePetPortrait(imageFile: File) {
  try {
    // 0. Get workflow info (optional)
    const workflowInfo = await getWorkflowInfo();
    console.log('Workflow info:', workflowInfo);
    
    // 1. Upload the image
    const uploadData = await uploadImage(imageFile);
    console.log('Image uploaded:', uploadData);
    
    // 2. Generate the portrait
    const generateData = await generatePortrait(uploadData.sessionId);
    console.log('Generation started:', generateData);
    
    // Store total nodes count
    const totalNodes = generateData.totalNodes;
    
    // 3. Connect to WebSocket for real-time updates
    const clientId = `pet-portrait-${uploadData.sessionId}`;
    const ws = connectWebSocket(clientId, {
      onProgress: (progress) => {
        console.log(`Basic progress: ${progress.toFixed(1)}%`);
      },
      onDetailedProgress: (data) => {
        console.log(`Detailed progress: ${data.progress.toFixed(1)}% - Node ${data.executedNodesCount}/${data.totalNodes} (${data.nodeInfo.type})`);
        
        // Update UI with more accurate progress
        updateProgressUI(data.progress, data.nodeInfo.type, data.executedNodesCount, data.totalNodes);
      },
      onNodeExecution: (nodeId) => {
        console.log(`Processing node: ${nodeId}`);
      },
      onComplete: () => {
        console.log('Processing completed');
      },
      onResult: (imageUrl) => {
        console.log('Portrait ready:', imageUrl);
        // Display the image or download it
        displayImage(imageUrl);
      }
    });
    
    // 4. Fallback: Poll for status updates
    const pollStatus = async () => {
      try {
        const statusData = await checkStatus(uploadData.sessionId);
        console.log('Status update:', statusData);
        
        // Update UI with detailed progress information
        if (statusData.currentNodeInfo) {
          updateProgressUI(
            statusData.progress,
            statusData.currentNodeInfo.type,
            statusData.executedNodesCount,
            statusData.totalNodes
          );
        }
        
        if (statusData.status === 'completed' && statusData.resultImage) {
          console.log('Portrait ready (from polling):', statusData.resultImage);
          displayImage(statusData.resultImage);
          return;
        }
        
        if (statusData.status !== 'failed') {
          // Continue polling if not completed or failed
          setTimeout(pollStatus, 2000);
        }
      } catch (error) {
        console.error('Error checking status:', error);
        setTimeout(pollStatus, 5000); // Retry after longer delay
      }
    };
    
    // Start polling as a fallback
    setTimeout(pollStatus, 5000);
    
  } catch (error) {
    console.error('Error generating portrait:', error);
  }
}

// Example function to update UI with detailed progress
function updateProgressUI(progress: number, nodeType: string, executedNodes: number, totalNodes: number) {
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  
  if (progressBar) {
    progressBar.style.width = `${progress}%`;
  }
  
  if (progressText) {
    progressText.textContent = `Processing: ${nodeType} (Node ${executedNodes}/${totalNodes}) - ${progress.toFixed(1)}%`;
  }
}

function displayImage(imageUrl: string) {
  const img = document.createElement('img');
  img.src = imageUrl;
  img.alt = 'Generated Pet Portrait';
  document.body.appendChild(img);
}
```

### Python

```python
import requests
import json
import websocket
import time
from typing import Optional, Dict, Any, Callable, List, TypedDict

class NodeInfo(TypedDict):
    id: str
    type: str
    title: str

class DetailedProgressData(TypedDict):
    progress: float
    currentNode: str
    nodeInfo: NodeInfo
    executedNodesCount: int
    totalNodes: int

class PetPortraitAPI:
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.session_id: Optional[str] = None
        self.client_id: Optional[str] = None
        self.ws: Optional[websocket.WebSocketApp] = None
        self.total_nodes: int = 0
    
    def upload_image(self, image_path: str) -> Dict[str, Any]:
        """Upload a pet image to the API."""
        with open(image_path, 'rb') as f:
            files = {'image': f}
            response = requests.post(f"{self.base_url}/api/upload", files=files)
        
        if response.status_code != 200:
            raise Exception(f"Upload failed: {response.json().get('error', 'Unknown error')}")
        
        data = response.json()
        self.session_id = data['sessionId']
        self.client_id = f"pet-portrait-{self.session_id}"
        return data
    
    def get_workflow_info(self) -> Dict[str, Any]:
        """Get information about the workflow."""
        response = requests.get(f"{self.base_url}/api/workflow-info")
        
        if response.status_code != 200:
            raise Exception(f"Failed to get workflow info: {response.json().get('error', 'Unknown error')}")
        
        data = response.json()
        self.total_nodes = data.get('nodeCount', 0)
        return data
    
    def generate_portrait(self) -> Dict[str, Any]:
        """Generate a portrait using the uploaded image."""
        if not self.session_id:
            raise Exception("No image uploaded yet. Call upload_image first.")
        
        response = requests.post(
            f"{self.base_url}/api/generate",
            json={"sessionId": self.session_id},
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code != 200:
            raise Exception(f"Generation failed: {response.json().get('error', 'Unknown error')}")
        
        data = response.json()
        self.total_nodes = data.get('totalNodes', self.total_nodes)
        return data
    
    def check_status(self) -> Dict[str, Any]:
        """Check the status of portrait generation."""
        if not self.session_id:
            raise Exception("No active session. Call upload_image first.")
        
        response = requests.get(f"{self.base_url}/api/status/{self.session_id}")
        
        if response.status_code != 200:
            raise Exception(f"Status check failed: {response.json().get('error', 'Unknown error')}")
        
        data = response.json()
        self.total_nodes = data.get('totalNodes', self.total_nodes)
        return data
    
    def regenerate_portrait(self) -> Dict[str, Any]:
        """Regenerate a portrait with different random seeds."""
        if not self.session_id:
            raise Exception("No active session. Call upload_image first.")
        
        response = requests.post(
            f"{self.base_url}/api/regenerate",
            json={"sessionId": self.session_id},
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code != 200:
            raise Exception(f"Regeneration failed: {response.json().get('error', 'Unknown error')}")
        
        data = response.json()
        self.total_nodes = data.get('totalNodes', self.total_nodes)
        return data
    
    def download_image(self, image_url: str, save_path: str) -> None:
        """Download an image from the API."""
        if not image_url.startswith("http"):
            # Convert relative URL to absolute
            image_url = f"{self.base_url}{image_url}"
        
        response = requests.get(image_url, stream=True)
        
        if response.status_code != 200:
            raise Exception(f"Download failed: {response.status_code}")
        
        with open(save_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
    
    def connect_websocket(self, 
                          on_progress: Callable[[float], None] = None,
                          on_detailed_progress: Callable[[DetailedProgressData], None] = None,
                          on_node_execution: Callable[[str], None] = None,
                          on_complete: Callable[[], None] = None,
                          on_result: Callable[[str], None] = None) -> None:
        """Connect to WebSocket for real-time updates."""
        if not self.client_id:
            raise Exception("No active session. Call upload_image first.")
        
        def on_message(ws, message):
            data = json.loads(message)
            if data['type'] == 'progress' and on_progress and 'id' in data['data']:
                progress = data['data']['value'] * 100
                on_progress(progress)
            elif data['type'] == 'detailed_progress' and on_detailed_progress:
                on_detailed_progress(data['data'])
            elif data['type'] == 'executing':
                if data['data']['node'] is None and on_complete:
                    on_complete()
                elif on_node_execution and data['data']['node']:
                    on_node_execution(data['data']['node'])
            elif data['type'] == 'result' and on_result:
                on_result(data['data']['resultImage'])
        
        def on_error(ws, error):
            print(f"WebSocket error: {error}")
        
        def on_close(ws, close_status_code, close_msg):
            print("WebSocket connection closed")
        
        def on_open(ws):
            print("WebSocket connection established")
        
        ws_url = f"ws://{self.base_url.replace('http://', '')}/ws?clientId={self.client_id}"
        self.ws = websocket.WebSocketApp(ws_url,
                                         on_message=on_message,
                                         on_error=on_error,
                                         on_close=on_close,
                                         on_open=on_open)
        
        # Start WebSocket connection in a separate thread
        import threading
        wst = threading.Thread(target=self.ws.run_forever)
        wst.daemon = True
        wst.start()
    
    def poll_until_complete(self, interval: int = 2, timeout: int = 300) -> Optional[Dict[str, Any]]:
        """Poll the status endpoint until portrait is complete or timeout is reached."""
        start_time = time.time()
        while time.time() - start_time < timeout:
            status_data = self.check_status()
            
            if status_data['status'] == 'completed' and status_data['resultImage']:
                return status_data
            
            if status_data['status'] == 'failed':
                raise Exception(f"Portrait generation failed: {status_data['message']}")
            
            time.sleep(interval)
        
        raise Exception(f"Timeout after {timeout} seconds")

# Example usage with detailed progress tracking
if __name__ == "__main__":
    api = PetPortraitAPI()
    
    # Get workflow info
    workflow_info = api.get_workflow_info()
    print(f"Workflow info: {workflow_info}")
    
    # Upload image
    upload_data = api.upload_image("path/to/pet_image.jpg")
    print(f"Image uploaded: {upload_data}")
    
    # Connect WebSocket for real-time updates
    def on_progress(progress):
        print(f"Basic progress: {progress:.1f}%")
    
    def on_detailed_progress(data):
        print(f"Detailed progress: {data['progress']:.1f}% - Node {data['executedNodesCount']}/{data['totalNodes']} ({data['nodeInfo']['type']})")
        
        # Update UI with more accurate progress information
        update_progress_ui(
            data['progress'], 
            data['nodeInfo']['type'], 
            data['executedNodesCount'], 
            data['totalNodes']
        )
    
    def on_node_execution(node_id):
        print(f"Processing node: {node_id}")
    
    def on_complete():
        print("Processing completed")
    
    def on_result(image_url):
        print(f"Portrait ready: {image_url}")
        # Download the image
        api.download_image(image_url, "pet_portrait.png")
    
    # Example function to update UI with detailed progress
    def update_progress_ui(progress, node_type, executed_nodes, total_nodes):
        # In a real application, this would update a progress bar and text
        print(f"[UI] {progress:.1f}% - {node_type} ({executed_nodes}/{total_nodes})")
    
    api.connect_websocket(
        on_progress=on_progress,
        on_detailed_progress=on_detailed_progress,
        on_node_execution=on_node_execution,
        on_complete=on_complete,
        on_result=on_result
    )
    
    # Generate portrait
    generate_data = api.generate_portrait()
    print(f"Generation started: {generate_data}")
    
    try:
        # Wait for completion (alternative to WebSocket)
        result = api.poll_until_complete(timeout=300)
        print(f"Portrait completed (from polling): {result}")
        api.download_image(result['resultImage'], "pet_portrait_from_polling.png")
    except Exception as e:
        print(f"Error or timeout: {e}")
```

## Error Handling

The API returns standard HTTP status codes:

- 200: OK - The request was successful
- 400: Bad Request - The request was invalid or cannot be served
- 404: Not Found - The requested resource does not exist
- 500: Internal Server Error - Something went wrong on the server

Error responses include a JSON object with an `error` field containing a description of the error:

```json
{
  "error": "Error message describing what went wrong"
}
```

## Rate Limiting

Currently, there are no rate limits implemented. However, be mindful of server resources, especially when generating multiple portraits in parallel.

## Session Lifecycle

1. Sessions are created when an image is uploaded
2. Sessions remain active during portrait generation
3. Sessions are automatically cleaned up after 24 hours of inactivity
4. Uploaded files associated with expired sessions are deleted

## Best Practices

1. **Handling User Inputs**
   - Always check the `/api/workflow-info` endpoint first to understand what user inputs are required
   - Provide values for all required user inputs when calling `/api/generate`
   - Use the default values from workflow info if specific values are not needed

2. **Image Dimensions**
   - The workflow uses a portrait orientation with aspect ratio of 0.68:1 (832x1216 pixels)
   - Note that ComfyUI stores dimensions in height x width (y,x) format, but our API returns them in width x height (x,y) format
   - Consider this ratio when preparing input images to maintain proper proportions
   - Landscape-oriented pet images may need cropping to fit the portrait orientation

3. Always check the session status before assuming a portrait is complete
4. Implement both WebSocket and polling for maximum reliability
5. Handle errors gracefully and provide feedback to users
6. Store session IDs securely if implementing a multi-user application
7. Implement appropriate timeouts for API calls and WebSocket connections
8. Use the detailed progress information to provide accurate feedback to users
9. Fetch workflow information at startup to understand the total number of nodes 