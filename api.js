// ComfyUI Workflow Executor API
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const FormData = require('form-data');
const WebSocket = require('ws');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// ComfyUI API endpoint
const COMFYUI_URL = process.env.COMFYUI_URL;
const COMFYUI_WS_URL = process.env.COMFYUI_WS_URL;

if (!COMFYUI_URL || !COMFYUI_WS_URL) {
  console.error('Error: COMFYUI_URL and COMFYUI_WS_URL must be set in .env file');
  process.exit(1);
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Store workflow metadata
const workflowsMetadata = new Map();

// Load existing workflow metadata
const workflowsDir = path.join(__dirname, 'workflows');
if (!fs.existsSync(workflowsDir)) {
  fs.mkdirSync(workflowsDir, { recursive: true });
}

// Load existing workflows on startup
try {
  const metadataPath = path.join(workflowsDir, 'metadata.json');
  if (fs.existsSync(metadataPath)) {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    Object.entries(metadata).forEach(([id, data]) => {
      workflowsMetadata.set(id, data);
    });
    console.log(`Loaded ${workflowsMetadata.size} workflow(s) metadata`);
  }
} catch (error) {
  console.error('Error loading workflow metadata:', error);
}

// Save workflow metadata
function saveWorkflowMetadata() {
  try {
    const metadataPath = path.join(workflowsDir, 'metadata.json');
    const metadata = Object.fromEntries(workflowsMetadata);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  } catch (error) {
    console.error('Error saving workflow metadata:', error);
  }
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadDir;
    
    if (file.fieldname === 'workflow') {
      uploadDir = path.join(__dirname, 'workflows');
    } else {
      uploadDir = path.join(__dirname, 'uploads');
    }
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    if (file.fieldname === 'workflow') {
      // For workflows, use a UUID to ensure uniqueness
      const workflowId = uuidv4();
      cb(null, `${workflowId}.json`);
    } else {
      // For other files (images), use timestamp
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'workflow') {
      // For workflow files, only accept JSON
      if (file.mimetype === 'application/json') {
        cb(null, true);
      } else {
        cb(new Error('Only JSON files are allowed for workflows'));
      }
    } else if (file.fieldname === 'image') {
      // For image files, only accept images
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'));
      }
    } else {
      cb(new Error('Unexpected field'));
    }
  }
});

// Store active sessions
const activeSessions = new Map();

// WebSocket connections for clients
const wsClients = new Map();

// WebSocket server
const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', (ws, req) => {
  const clientId = req.url.split('=')[1];
  console.log(`WebSocket client connected: ${clientId}`);
  
  wsClients.set(clientId, ws);
  
  ws.on('message', (message) => {
    console.log(`Received message from client ${clientId}: ${message}`);
  });
  
  ws.on('close', () => {
    console.log(`WebSocket client disconnected: ${clientId}`);
    wsClients.delete(clientId);
  });
});

// API Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'ComfyUI Workflow Executor API is running' });
});

// List workflows endpoint
app.get('/api/workflows', (req, res) => {
  try {
    const workflows = Array.from(workflowsMetadata.entries()).map(([id, data]) => ({
      id,
      ...data
    }));
    
    res.json({
      success: true,
      workflows: workflows
    });
  } catch (error) {
    console.error('Error listing workflows:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get workflow endpoint
app.get('/api/workflows/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    if (!workflowsMetadata.has(id)) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    
    const metadata = workflowsMetadata.get(id);
    const workflowPath = path.join(workflowsDir, `${id}.json`);
    
    if (!fs.existsSync(workflowPath)) {
      return res.status(404).json({ error: 'Workflow file not found' });
    }
    
    const workflowData = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
    
    res.json({
      success: true,
      workflow: {
        id,
        ...metadata,
        data: workflowData
      }
    });
  } catch (error) {
    console.error('Error getting workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload workflow endpoint
app.post('/api/upload-workflow', upload.single('workflow'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No workflow file provided' });
    }
    
    const workflowId = path.basename(req.file.filename, '.json');
    const workflowName = req.body.name || 'Untitled Workflow';
    const workflowDescription = req.body.description || '';
    
    // Read and validate the workflow file
    const workflowData = JSON.parse(fs.readFileSync(req.file.path, 'utf8'));
    
    // Count nodes
    const nodeCount = Object.keys(workflowData).length;
    
    // Store workflow metadata
    const metadata = {
      name: workflowName,
      description: workflowDescription,
      uploadTime: new Date().toISOString(),
      nodeCount,
      fileName: req.file.filename
    };
    
    workflowsMetadata.set(workflowId, metadata);
    saveWorkflowMetadata();
    
    res.json({
      success: true,
      workflow: {
        id: workflowId,
        ...metadata
      }
    });
  } catch (error) {
    console.error('Error uploading workflow:', error);
    // Clean up the uploaded file if there was an error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete workflow endpoint
app.delete('/api/workflows/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    if (!workflowsMetadata.has(id)) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    
    const workflowPath = path.join(workflowsDir, `${id}.json`);
    
    // Delete the workflow file
    if (fs.existsSync(workflowPath)) {
      fs.unlinkSync(workflowPath);
    }
    
    // Remove from metadata
    workflowsMetadata.delete(id);
    saveWorkflowMetadata();
    
    res.json({
      success: true,
      message: 'Workflow deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload image endpoint
app.post('/api/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    // Get session ID from request or create a new one
    let sessionId = req.body.sessionId;
    let clientId;
    
    if (!sessionId) {
      // Create a new session if none provided
      sessionId = uuidv4();
      clientId = `comfyui-${sessionId}`;
      
      // Initialize new session
      activeSessions.set(sessionId, {
        clientId,
        status: 'initialized',
        uploadTime: new Date(),
        executedNodes: new Set(),
        nodeProgress: {}
      });
    } else {
      // Use existing session
      if (!activeSessions.has(sessionId)) {
        return res.status(400).json({ error: 'Invalid session ID' });
      }
      
      clientId = activeSessions.get(sessionId).clientId;
    }
    
    // Add a timestamp to the filename to prevent caching
    const timestamp = Date.now();
    const originalFilename = req.file.originalname;
    const timestampedFilename = `${timestamp}-${originalFilename}`;
    
    console.log(`Processing upload: original filename=${originalFilename}, timestamped filename=${timestampedFilename}`);
    
    // Upload to ComfyUI with timestamped filename
    const formData = new FormData();
    formData.append('image', fs.createReadStream(req.file.path), timestampedFilename);
    formData.append('overwrite', 'true');
    
    const uploadResponse = await fetch(`${COMFYUI_URL}/upload/image`, {
      method: 'POST',
      body: formData
    });
    
    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload image to ComfyUI: ${uploadResponse.statusText}`);
    }
    
    const uploadData = await uploadResponse.json();
    console.log('Upload response from ComfyUI:', uploadData);
    
    // Update session data
    const session = activeSessions.get(sessionId);
    session.imageData = {
      filename: uploadData.name,
      subfolder: uploadData.subfolder || '',
      type: 'input',
      originalFilename: originalFilename,
      timestamp: timestamp
    };
    session.status = 'image_uploaded';
    session.filePath = req.file.path;
    
    res.json({
      success: true,
      sessionId,
      message: 'Image uploaded successfully',
      imageUrl: `/api/images/${uploadData.name}?type=input&subfolder=${uploadData.subfolder || ''}`
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: error.message });
  }
});

// Execute workflow endpoint
app.post('/api/execute', async (req, res) => {
  try {
    const { workflowId, sessionId, userInputs } = req.body;
    
    // Check if we have a valid workflow
    if (!workflowId || !workflowsMetadata.has(workflowId)) {
      return res.status(400).json({ error: 'Invalid workflow ID' });
    }
    
    // Load the workflow data
    const workflowPath = path.join(workflowsDir, `${workflowId}.json`);
    const workflowData = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
    
    // Get or create session
    let session;
    if (sessionId && activeSessions.has(sessionId)) {
      session = activeSessions.get(sessionId);
      session.workflowData = workflowData;
    } else {
      const newSessionId = uuidv4();
      session = {
        sessionId: newSessionId,
        clientId: `comfyui-${newSessionId}`,
        workflowData,
        status: 'initialized',
        uploadTime: new Date(),
        nodeCount: Object.keys(workflowData).length,
        executedNodes: new Set(),
        nodeProgress: {}
      };
      activeSessions.set(newSessionId, session);
    }
    
    // Reset executed nodes
    session.executedNodes = new Set();
    session.nodeProgress = {};
    
    // Create a copy of the workflow to modify
    const modifiedWorkflow = JSON.parse(JSON.stringify(session.workflowData));
    
    // Apply user inputs if provided
    if (userInputs) {
      for (const [nodeId, inputs] of Object.entries(userInputs)) {
        if (modifiedWorkflow[nodeId]) {
          // Initialize inputs object if it doesn't exist
          if (!modifiedWorkflow[nodeId].inputs) {
            modifiedWorkflow[nodeId].inputs = {};
          }
          
          // Apply each input
          for (const [key, value] of Object.entries(inputs)) {
            modifiedWorkflow[nodeId].inputs[key] = value;
          }
        }
      }
    }
    
    // Modify workflow with the uploaded image if available
    let finalWorkflow = modifiedWorkflow;
    if (session.imageData) {
      finalWorkflow = modifyWorkflow(modifiedWorkflow, session.imageData);
    }
    
    // Queue the prompt
    const promptData = {
      prompt: finalWorkflow,
      client_id: session.clientId
    };
    
    const queueResponse = await fetch(`${COMFYUI_URL}/prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(promptData)
    });
    
    if (!queueResponse.ok) {
      throw new Error(`Failed to queue prompt: ${queueResponse.statusText}`);
    }
    
    const queueData = await queueResponse.json();
    console.log('Queue response from ComfyUI:', queueData);
    
    // Update session
    session.promptId = queueData.prompt_id;
    session.status = 'processing';
    session.startTime = new Date();
    session.progress = 0;
    
    // Connect to ComfyUI WebSocket to monitor progress
    connectToComfyUI(session);
    
    res.json({
      success: true,
      sessionId,
      promptId: queueData.prompt_id,
      message: 'Workflow execution started',
      wsEndpoint: `/ws?clientId=${session.clientId}`,
      totalNodes: session.nodeCount || Object.keys(session.workflowData).length
    });
  } catch (error) {
    console.error('Error executing workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get session status endpoint
app.get('/api/status/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId || !activeSessions.has(sessionId)) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const session = activeSessions.get(sessionId);
    
    // Get current node info if available
    let currentNodeInfo = null;
    if (session.currentNode && session.workflowData && session.workflowData[session.currentNode]) {
      const node = session.workflowData[session.currentNode];
      currentNodeInfo = {
        id: session.currentNode,
        type: node.class_type || 'Unknown',
        title: node._meta?.title || node.class_type || 'Unknown'
      };
    }
    
    res.json({
      sessionId,
      status: session.status,
      progress: session.progress || 0,
      currentNode: session.currentNode || null,
      currentNodeInfo: currentNodeInfo,
      message: session.message || 'Initializing',
      resultImage: session.resultImage || null,
      startTime: session.startTime,
      endTime: session.endTime,
      executedNodesCount: session.executedNodes ? session.executedNodes.size : 0,
      totalNodes: session.nodeCount || (session.workflowData ? Object.keys(session.workflowData).length : 0)
    });
  } catch (error) {
    console.error('Error getting session status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Proxy for ComfyUI images
app.get('/api/images/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const { type = 'output', subfolder = '' } = req.query;
    
    console.log(`Image request: filename=${filename}, type=${type}, subfolder=${subfolder}`);
    
    // Construct the URL to fetch the image from ComfyUI
    const imageUrl = `${COMFYUI_URL}/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}&type=${encodeURIComponent(type)}`;
    console.log(`Fetching image from ComfyUI: ${imageUrl}`);
    
    // Fetch the image with a timeout
    const imageResponse = await fetch(imageUrl, { 
      timeout: 10000,
      headers: {
        'Accept': 'image/*'
      }
    });
    
    if (!imageResponse.ok) {
      console.error(`Failed to fetch image from ComfyUI: ${imageResponse.status} ${imageResponse.statusText}`);
      
      // Try alternative path formats if the original fails
      if (type === 'output') {
        // Try without subfolder
        const altImageUrl = `${COMFYUI_URL}/view?filename=${encodeURIComponent(filename)}&type=${encodeURIComponent(type)}`;
        console.log(`Trying alternative URL: ${altImageUrl}`);
        
        const altImageResponse = await fetch(altImageUrl, {
          timeout: 10000,
          headers: {
            'Accept': 'image/*'
          }
        });
        
        if (altImageResponse.ok) {
          console.log(`Successfully fetched image from alternative URL`);
          res.setHeader('Content-Type', altImageResponse.headers.get('Content-Type'));
          res.setHeader('Content-Length', altImageResponse.headers.get('Content-Length'));
          return altImageResponse.body.pipe(res);
        }
      }
      
      throw new Error(`Failed to fetch image from ComfyUI: ${imageResponse.statusText}`);
    }
    
    console.log(`Successfully fetched image from ComfyUI, content type: ${imageResponse.headers.get('Content-Type')}`);
    
    // Set appropriate headers
    res.setHeader('Content-Type', imageResponse.headers.get('Content-Type'));
    res.setHeader('Content-Length', imageResponse.headers.get('Content-Length'));
    
    // Pipe the image data to the response
    imageResponse.body.pipe(res);
  } catch (error) {
    console.error('Error fetching image:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT} and is accessible from LAN`);
});

// Handle WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
  // Extract client ID from URL
  const url = new URL(request.url, `http://${request.headers.host}`);
  const clientId = url.searchParams.get('clientId');
  
  if (!clientId) {
    socket.destroy();
    return;
  }
  
  console.log(`WebSocket upgrade request for client: ${clientId}`);
  
  // Upgrade the connection
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// Helper function to connect to ComfyUI WebSocket
function connectToComfyUI(session) {
  try {
    // Close existing connection if any
    if (session.comfyWs && session.comfyWs.readyState === WebSocket.OPEN) {
      session.comfyWs.close();
    }
    
    // Create new WebSocket connection to ComfyUI
    const comfyWs = new WebSocket(COMFYUI_WS_URL);
    session.comfyWs = comfyWs;
    
    comfyWs.on('open', () => {
      console.log(`Connected to ComfyUI WebSocket for session ${session.clientId}`);
    });
    
    comfyWs.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        
        // Handle different message types from ComfyUI
        if (message.type === 'progress') {
          const nodeId = message.data.id;
          const progress = message.data.value;
          
          // Store progress for this node
          session.nodeProgress[nodeId] = progress;
          
          // Calculate overall progress
          const calculatedProgress = calculateProgress(nodeId, session);
          
          // Update session progress
          session.progress = calculatedProgress;
          session.currentNode = nodeId;
          
          // Get node info
          const nodeInfo = getNodeInfo(nodeId, session);
          
          // Find client WebSocket
          const clientWs = wsClients.get(session.clientId);
          if (clientWs && clientWs.readyState === WebSocket.OPEN) {
            // Send progress update to client
            clientWs.send(JSON.stringify({
              type: 'progress',
              data: {
                progress: calculatedProgress,
                currentNode: nodeId,
                nodeInfo: nodeInfo,
                executedNodesCount: session.executedNodes.size,
                totalNodes: session.nodeCount || (session.workflowData ? Object.keys(session.workflowData).length : 0)
              }
            }));
          }
        } 
        else if (message.type === 'executing') {
          const nodeId = message.data.node;
          
          // If node is null, execution is complete
          if (nodeId === null) {
            console.log(`Execution completed for session ${session.clientId}`);
            
            // Update session
            session.status = 'completed';
            session.endTime = new Date();
            session.progress = 100;
            
            // Find client WebSocket
            const clientWs = wsClients.get(session.clientId);
            if (clientWs && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'executing',
                data: message.data
              }));
            }
          } else {
            console.log(`Executing node ${nodeId} for session ${session.clientId}`);
            
            // Add to executed nodes
            session.executedNodes.add(nodeId);
            
            // Update session
            session.currentNode = nodeId;
            session.progress = calculateProgress(nodeId, session);
            
            // Find client WebSocket
            const clientWs = wsClients.get(session.clientId);
            if (clientWs && clientWs.readyState === WebSocket.OPEN) {
              const nodeInfo = getNodeInfo(nodeId, session);
              clientWs.send(JSON.stringify({
                type: 'executing',
                data: {
                  node: nodeId,
                  progress: session.progress,
                  nodeInfo: nodeInfo,
                  executedNodesCount: session.executedNodes.size,
                  totalNodes: session.nodeCount || (session.workflowData ? Object.keys(session.workflowData).length : 0)
                }
              }));
            }
          }
        }
        else if (message.type === 'executed') {
          const nodeId = message.data.node;
          console.log(`Node ${nodeId} executed for session ${session.clientId}`);
          session.executedNodes.add(nodeId);
        }
        else if (message.type === 'execution_error') {
          console.error(`Execution error for session ${session.clientId}:`, message.data.exception_message);
          
          // Update session
          session.status = 'failed';
          
          // Find client WebSocket
          const clientWs = wsClients.get(session.clientId);
          if (clientWs && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({
              type: 'error',
              data: {
                message: message.data.exception_message
              }
            }));
          }
        }
        else if (message.type === 'execution_cached') {
          console.log(`Execution cached for session ${session.clientId}`);
        }
        else if (message.type === 'status') {
          if (message.data.status && message.data.status.exec_info && message.data.status.exec_info.queue_remaining === 0) {
            checkForCompletedImages(session);
          }
        }
      } catch (error) {
        console.error(`Error processing ComfyUI WebSocket message for session ${session.clientId}:`, error);
      }
    });
    
    comfyWs.on('error', (error) => {
      console.error(`ComfyUI WebSocket error for session ${session.clientId}:`, error);
    });
    
    comfyWs.on('close', () => {
      console.log(`ComfyUI WebSocket closed for session ${session.clientId}`);
    });
  } catch (error) {
    console.error(`Error connecting to ComfyUI WebSocket for session ${session.clientId}:`, error);
  }
}

// Helper function to check for completed images
async function checkForCompletedImages(session) {
  try {
    // Get history from ComfyUI
    const historyResponse = await fetch(`${COMFYUI_URL}/history`);
    
    if (!historyResponse.ok) {
      throw new Error(`Failed to get history from ComfyUI: ${historyResponse.statusText}`);
    }
    
    const historyData = await historyResponse.json();
    console.log(`Got history data from ComfyUI, looking for prompt ID: ${session.promptId}`);
    
    // Find the prompt with our prompt ID
    if (historyData[session.promptId]) {
      const promptData = historyData[session.promptId];
      console.log(`Found prompt data for ${session.promptId}, looking for SaveImage nodes`);
      
      // Find SaveImage nodes
      for (const nodeId in promptData.outputs) {
        const nodeOutputs = promptData.outputs[nodeId];
        console.log(`Checking node ${nodeId} outputs:`, JSON.stringify(nodeOutputs).substring(0, 200));
        
        // Check if this is a SaveImage node with images
        if (nodeOutputs.images) {
          // Get the first image
          const image = nodeOutputs.images[0];
          console.log(`Found image in node ${nodeId}:`, image);
          
          // Create image URL - use the full filename with type and subfolder
          const imageUrl = `/api/images/${encodeURIComponent(image.filename)}?type=output&subfolder=${encodeURIComponent(image.subfolder || '')}`;
          
          // Verify the image exists before updating the session
          try {
            const checkImageUrl = `${COMFYUI_URL}/view?filename=${encodeURIComponent(image.filename)}&type=output&subfolder=${encodeURIComponent(image.subfolder || '')}`;
            console.log(`Verifying image exists at: ${checkImageUrl}`);
            
            const imageCheckResponse = await fetch(checkImageUrl, { method: 'HEAD' });
            if (!imageCheckResponse.ok) {
              console.warn(`Image verification failed: ${imageCheckResponse.status} ${imageCheckResponse.statusText}`);
              // Continue checking other nodes if this image doesn't exist
              continue;
            }
          } catch (error) {
            console.warn(`Error verifying image: ${error.message}`);
            // Continue checking other nodes if verification fails
            continue;
          }
          
          // Update session
          session.status = 'completed';
          session.endTime = new Date();
          session.progress = 100;
          session.resultImage = imageUrl;
          
          console.log(`Found result image for session ${session.clientId}: ${imageUrl}`);
          
          // Find client WebSocket
          const clientWs = wsClients.get(session.clientId);
          if (clientWs && clientWs.readyState === WebSocket.OPEN) {
            // Notify client of result
            clientWs.send(JSON.stringify({
              type: 'result',
              data: {
                sessionId: session.sessionId || session.clientId.replace('comfyui-', ''),
                status: 'completed',
                resultImage: imageUrl,
                executedNodesCount: session.executedNodes.size,
                totalNodes: session.nodeCount || (session.workflowData ? Object.keys(session.workflowData).length : 0)
              }
            }));
          }
          
          break;
        }
      }
    } else {
      console.log(`Prompt ID ${session.promptId} not found in history data`);
    }
  } catch (error) {
    console.error(`Error checking for completed images for session ${session.clientId}:`, error);
  }
}

// Helper function to modify workflow
function modifyWorkflow(workflow, imageData) {
  try {
    // Create a deep copy of the workflow
    const modifiedWorkflow = JSON.parse(JSON.stringify(workflow));
    
    // Add a timestamp to prevent caching
    const timestamp = Date.now();
    const imageFilename = imageData.filename;
    
    console.log(`Modifying workflow for image: ${imageFilename}, subfolder: ${imageData.subfolder || 'none'}, timestamp: ${timestamp}`);
    
    // Find the LoadImage node(s) in the workflow
    let loadImageNodesFound = 0;
    
    for (const [nodeId, node] of Object.entries(modifiedWorkflow)) {
      // Look for LoadImage nodes
      if (node.class_type === 'LoadImage') {
        loadImageNodesFound++;
        console.log(`Found LoadImage node ${nodeId}:`, JSON.stringify(node).substring(0, 200));
        
        // Instead of modifying the existing node, completely replace it with a new one
        // This ensures ComfyUI doesn't use cached data
        modifiedWorkflow[nodeId] = {
          class_type: "LoadImage",
          _meta: node._meta || { title: "Load Image" },
          inputs: {
            // Only keep the essential properties and set our image
            image: imageFilename,
            upload: imageFilename,
            // Add a unique timestamp to force ComfyUI to reload
            timestamp: timestamp + parseInt(nodeId, 10)
          }
        };
        
        // If there's a subfolder, add it
        if (imageData.subfolder) {
          modifiedWorkflow[nodeId].inputs.subfolder = imageData.subfolder;
        }
        
        console.log(`Replaced LoadImage node ${nodeId} with new node using image: ${imageFilename}`);
      }
      
      // Add random seeds to KSampler nodes for variation in regeneration
      if (node.class_type === 'KSampler' || node.class_type === 'KSamplerAdvanced') {
        // Only generate random seeds if not provided by user inputs
        if (!node.inputs?.seed_override) {
          // Generate random seeds between 0 and 2^32-1
          const randomSeed = Math.floor(Math.random() * 4294967295);
          node.inputs = node.inputs || {};
          node.inputs.seed = randomSeed;
          console.log(`Set random seed ${randomSeed} for node ${nodeId}`);
        }
      }
    }
    
    if (loadImageNodesFound === 0) {
      console.warn('No LoadImage nodes found in workflow!');
    } else {
      console.log(`Replaced ${loadImageNodesFound} LoadImage nodes in workflow`);
    }
    
    // Log the modified workflow for debugging (first 500 chars)
    console.log('Modified workflow (first 500 chars):', JSON.stringify(modifiedWorkflow).substring(0, 500));
    
    return modifiedWorkflow;
  } catch (error) {
    console.error('Error modifying workflow:', error);
    throw new Error(`Failed to modify workflow: ${error.message}`);
  }
}

// Calculate progress percentage based on current node
function calculateProgress(nodeId, session) {
  if (!nodeId) {
    return 0;
  }
  
  const workflowNodeIds = session.workflowData ? Object.keys(session.workflowData) : [];
  
  if (!workflowNodeIds.length) {
    return 0;
  }
  
  // Fallback: use node ID as a rough estimate
  const nodeIdNum = parseInt(nodeId, 10);
  if (!isNaN(nodeIdNum)) {
    const highestNodeId = Math.max(...workflowNodeIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id)));
    return Math.round((nodeIdNum / highestNodeId) * 100);
  }
  
  return 50;
}

// Get node information
function getNodeInfo(nodeId, session) {
  if (!nodeId || !session.workflowData || !session.workflowData[nodeId]) {
    return { id: nodeId, type: 'Unknown' };
  }
  
  const node = session.workflowData[nodeId];
  const nodeType = node.class_type || 'Unknown';
  const nodeTitle = node._meta?.title || nodeType;
  
  return {
    id: nodeId,
    type: nodeType,
    title: nodeTitle
  };
}