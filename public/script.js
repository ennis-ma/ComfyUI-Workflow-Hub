/**
 * ComfyUI Workflow Executor - Frontend Script
 */

// DOM elements
const workflowUploadForm = document.getElementById('workflowUploadForm');
const workflowUploadInput = document.getElementById('workflowUpload');
const workflowNameInput = document.getElementById('workflowName');
const workflowDescriptionInput = document.getElementById('workflowDescription');
const workflowList = document.getElementById('workflowList');
const imageUploadInput = document.getElementById('imageUpload');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('imagePreview');
const progressContainer = document.getElementById('progress-container');
const progressStatus = document.getElementById('progress-status');
const progressFill = document.getElementById('progress-fill');
const resultContainer = document.getElementById('result-container');
const resultImage = document.getElementById('resultImage');
const workflowContainer = document.getElementById('workflow-container');
const workflowInfo = document.getElementById('workflow-info');
const userInputsContainer = document.getElementById('user-inputs-container');
const executeButton = document.getElementById('executeButton');
const regenerateButton = document.getElementById('regenerateButton');
const downloadButton = document.getElementById('downloadButton');
const newWorkflowButton = document.getElementById('newWorkflowButton');

// State variables
let sessionId = null;
let wsConnection = null;
let statusInterval = null;
let selectedWorkflowId = null;
let workflowData = null;
let workflowUserInputs = {};

// Progress messages for different stages
const progressMessages = {
  initializing: "Initializing...",
  preparing: "Preparing workflow...",
  processing: "Processing workflow...",
  generating: "Generating image...",
  finalizing: "Finalizing result...",
  completed: "Execution completed"
};

// Map node types to stages
const nodeTypeToStage = {
  "LoadImage": "preparing",
  "CLIPTextEncode": "preparing",
  "KSampler": "generating",
  "VAEDecode": "finalizing",
  "SaveImage": "finalizing"
};

// Load workflows on page load
document.addEventListener('DOMContentLoaded', async function() {
  await loadWorkflows();
  
  // Disable execute button initially
  if (executeButton) {
    executeButton.disabled = true;
  }
  
  // Disable regenerate button initially
  if (regenerateButton) {
    regenerateButton.disabled = true;
  }
  
  // Disable download button initially
  if (downloadButton) {
    downloadButton.disabled = true;
  }
});

// Load and display workflows
async function loadWorkflows() {
  try {
    const response = await fetch('/api/workflows');
    const data = await response.json();
    
    if (data.success) {
      displayWorkflows(data.workflows);
    } else {
      console.error('Error loading workflows:', data.error);
    }
  } catch (error) {
    console.error('Error loading workflows:', error);
  }
}

// Display workflows in the list
function displayWorkflows(workflows) {
  workflowList.innerHTML = '';
  
  if (workflows.length === 0) {
    workflowList.innerHTML = '<p class="text-gray-500">No workflows uploaded yet</p>';
    return;
  }
  
  workflows.forEach(workflow => {
    const workflowCard = document.createElement('div');
    workflowCard.className = 'bg-gray-50 p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow';
    
    workflowCard.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <h4 class="font-semibold text-lg">${workflow.name}</h4>
          <p class="text-sm text-gray-600">${workflow.description || 'No description'}</p>
          <p class="text-xs text-gray-500 mt-1">Nodes: ${workflow.nodeCount} • Uploaded: ${new Date(workflow.uploadTime).toLocaleDateString()}</p>
        </div>
        <div class="flex gap-2">
          <button class="select-workflow-button px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700" data-workflow-id="${workflow.id}">
            Select
          </button>
          <button class="delete-workflow-button px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700" data-workflow-id="${workflow.id}">
            Delete
          </button>
        </div>
      </div>
    `;
    
    // Add event listeners
    const selectButton = workflowCard.querySelector('.select-workflow-button');
    const deleteButton = workflowCard.querySelector('.delete-workflow-button');
    
    selectButton.addEventListener('click', () => selectWorkflow(workflow.id));
    deleteButton.addEventListener('click', () => deleteWorkflow(workflow.id));
    
    workflowList.appendChild(workflowCard);
  });
}

// Handle workflow upload
async function handleWorkflowUpload(event) {
  event.preventDefault();
  
  const file = workflowUploadInput.files[0];
  if (!file) {
    alert('Please select a workflow file');
    return;
  }
  
  const name = workflowNameInput.value.trim() || file.name.replace('.json', '');
  const description = workflowDescriptionInput.value.trim();
  
  try {
    const formData = new FormData();
    formData.append('workflow', file);
    formData.append('name', name);
    formData.append('description', description);
    
    const response = await fetch('/api/upload-workflow', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Reset form
      workflowUploadForm.reset();
      
      // Reload workflows
      await loadWorkflows();
      
      // Select the newly uploaded workflow
      await selectWorkflow(data.workflow.id);
    } else {
      alert(`Error: ${data.error || 'Failed to upload workflow'}`);
    }
  } catch (error) {
    console.error('Error uploading workflow:', error);
    alert(`Error: ${error.message || 'Failed to upload workflow'}`);
  }
}

// Select a workflow
async function selectWorkflow(workflowId) {
  try {
    const response = await fetch(`/api/workflows/${workflowId}`);
    const data = await response.json();
    
    if (data.success) {
      selectedWorkflowId = workflowId;
      workflowData = data.workflow.data;
      
      // Display workflow info
      displayWorkflowInfo(workflowData, data.workflow.nodeCount);
      
      // Analyze workflow for user inputs
      analyzeWorkflow(workflowData);
      
      // Show workflow container
      workflowContainer.classList.remove('hidden');
      
      // Hide result container if visible
      resultContainer.classList.add('hidden');
      
      // Enable execute button if an image is uploaded
      executeButton.disabled = !imageUploadInput.files.length;
      
      // Scroll to workflow container
      workflowContainer.scrollIntoView({ behavior: 'smooth' });
    } else {
      alert(`Error: ${data.error || 'Failed to load workflow'}`);
    }
  } catch (error) {
    console.error('Error selecting workflow:', error);
    alert(`Error: ${error.message || 'Failed to load workflow'}`);
  }
}

// Delete a workflow
async function deleteWorkflow(workflowId) {
  if (!confirm('Are you sure you want to delete this workflow?')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/workflows/${workflowId}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (data.success) {
      // If the deleted workflow was selected, hide the workflow container
      if (selectedWorkflowId === workflowId) {
        selectedWorkflowId = null;
        workflowData = null;
        workflowContainer.classList.add('hidden');
      }
      
      // Reload workflows
      await loadWorkflows();
    } else {
      alert(`Error: ${data.error || 'Failed to delete workflow'}`);
    }
  } catch (error) {
    console.error('Error deleting workflow:', error);
    alert(`Error: ${error.message || 'Failed to delete workflow'}`);
  }
}

// Handle image upload
async function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    // Show preview
    const reader = new FileReader();
    reader.onload = function(e) {
      imagePreview.src = e.target.result;
      imagePreviewContainer.classList.remove('hidden');
    };
    reader.readAsDataURL(file);

    // Upload the image
    const formData = new FormData();
    formData.append('image', file);
    
    // If we have a session ID, include it
    if (sessionId) {
      formData.append('sessionId', sessionId);
    }
    
    const response = await fetch('/api/upload-image', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (result.success) {
      // If we didn't have a session ID yet, set it now
      if (!sessionId) {
        sessionId = result.sessionId;
      }
      
      // Enable execute button if a workflow is selected
      executeButton.disabled = !selectedWorkflowId;
    } else {
      alert(`Error: ${result.error || "Failed to upload image"}`);
    }
  } catch (error) {
    console.error("Error uploading image:", error);
    alert(`Error: ${error.message || "Failed to upload image"}`);
  }
}

// Execute workflow
async function executeWorkflow() {
  if (!selectedWorkflowId) {
    alert("Please select a workflow first");
    return;
  }

  try {
    // Show progress container
    progressContainer.classList.remove('hidden');
    progressFill.style.width = '0%';
    progressStatus.textContent = progressMessages.initializing;
    
    // Hide result container if visible
    resultContainer.classList.add('hidden');
    
    // Disable execute button
    executeButton.disabled = true;
    
    // Connect to WebSocket for real-time updates
    connectWebSocket();
    
    // Send execute request
    const response = await fetch('/api/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        workflowId: selectedWorkflowId,
        sessionId,
        userInputs: workflowUserInputs
      })
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || "Failed to execute workflow");
    }
    
    // Start polling for status
    startStatusPolling();
  } catch (error) {
    console.error("Error executing workflow:", error);
    progressStatus.textContent = `Error: ${error.message || "Failed to execute workflow"}`;
    executeButton.disabled = false;
  }
}

// Connect to WebSocket for real-time updates
function connectWebSocket() {
  // Close existing connection if any
  if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
    wsConnection.close();
  }
  
  // Create WebSocket URL
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws?clientId=comfyui-${sessionId}`;
  
  // Connect to WebSocket
  wsConnection = new WebSocket(wsUrl);
  
  wsConnection.onopen = function() {
    console.log("WebSocket connected");
  };
  
  wsConnection.onmessage = function(event) {
    try {
      const message = JSON.parse(event.data);
      
      // Handle different message types
      if (message.type === 'progress') {
        updateProgress(message.data);
      } else if (message.type === 'executing') {
        updateExecuting(message.data);
      } else if (message.type === 'result') {
        showResult(message.data);
      } else if (message.type === 'error') {
        showError(message.data);
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
    }
  };
  
  wsConnection.onerror = function(error) {
    console.error("WebSocket error:", error);
  };
  
  wsConnection.onclose = function() {
    console.log("WebSocket closed");
  };
}

// Start polling for status
function startStatusPolling() {
  // Clear existing interval if any
  if (statusInterval) {
    clearInterval(statusInterval);
  }
  
  // Poll every 2 seconds
  statusInterval = setInterval(async () => {
    try {
      const response = await fetch(`/api/status/${sessionId}`);
      const status = await response.json();
      
      // Update progress
      updateProgress({
        progress: status.progress,
        currentNode: status.currentNode,
        nodeInfo: status.currentNodeInfo,
        executedNodesCount: status.executedNodesCount,
        totalNodes: status.totalNodes
      });
      
      // Check if completed
      if (status.status === 'completed' && status.resultImage) {
        showResult({
          resultImage: status.resultImage
        });
        
        // Stop polling
        clearInterval(statusInterval);
        statusInterval = null;
      }
      
      // Check if failed
      if (status.status === 'failed') {
        showError({
          message: status.message || "Execution failed"
        });
        
        // Stop polling
        clearInterval(statusInterval);
        statusInterval = null;
      }
    } catch (error) {
      console.error("Error polling status:", error);
    }
  }, 2000);
}

// Update progress
function updateProgress(data) {
  // Update progress bar
  progressFill.style.width = `${data.progress}%`;
  
  // Update progress text
  if (data.nodeInfo) {
    const stage = getStageFromNodeType(data.nodeInfo.type);
    progressStatus.textContent = `${progressMessages[stage]} (${data.executedNodesCount}/${data.totalNodes} nodes)`;
  } else {
    progressStatus.textContent = progressMessages.processing;
  }
}

// Update executing node
function updateExecuting(data) {
  // Similar to updateProgress but specifically for executing events
  if (data.nodeInfo) {
    const stage = getStageFromNodeType(data.nodeInfo.type);
    progressStatus.textContent = `${progressMessages[stage]}: ${data.nodeInfo.title || data.nodeInfo.type}`;
  }
}

// Show result
function showResult(data) {
  // Update progress to 100%
  progressFill.style.width = '100%';
  progressStatus.textContent = progressMessages.completed;
  
  // Show result image
  resultImage.src = data.resultImage;
  resultContainer.classList.remove('hidden');
  
  // Enable buttons
  executeButton.disabled = false;
  regenerateButton.disabled = false;
  downloadButton.disabled = false;
  
  // Set download button href
  downloadButton.href = data.resultImage;
  downloadButton.download = `comfyui-result-${Date.now()}.png`;
}

// Show error
function showError(data) {
  progressStatus.textContent = `Error: ${data.message || "Execution failed"}`;
  progressFill.classList.add('error');
  
  // Enable execute button
  executeButton.disabled = false;
}

// Get stage from node type
function getStageFromNodeType(nodeType) {
  return nodeTypeToStage[nodeType] || "processing";
}

// Regenerate (re-execute the workflow)
function regenerate() {
  executeWorkflow();
}

// Download result image
function downloadResult() {
  // The download attribute on the anchor tag handles this
}

// Display workflow information
function displayWorkflowInfo(workflow, nodeCount) {
  // Count different node types
  const nodeTypes = {};
  Object.values(workflow).forEach(node => {
    const type = node.class_type || "Unknown";
    nodeTypes[type] = (nodeTypes[type] || 0) + 1;
  });
  
  // Create info text
  let infoText = `<strong>Workflow loaded:</strong> ${nodeCount} nodes<br>`;
  infoText += `<strong>Node types:</strong><br>`;
  
  // Add the most common node types
  const sortedTypes = Object.entries(nodeTypes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  sortedTypes.forEach(([type, count]) => {
    infoText += `- ${type}: ${count}<br>`;
  });
  
  if (Object.keys(nodeTypes).length > 5) {
    infoText += `- And ${Object.keys(nodeTypes).length - 5} more types...<br>`;
  }
  
  workflowInfo.innerHTML = infoText;
}

// Analyze workflow for user inputs
function analyzeWorkflow(workflow) {
  // Clear previous inputs
  userInputsContainer.innerHTML = '';
  workflowUserInputs = {};
  
  // Look for nodes that typically require user input
  for (const [nodeId, node] of Object.entries(workflow)) {
    // Check for text input nodes (prompts)
    if (node.class_type === 'CLIPTextEncode') {
      // Check if this node has a title indicating it's for user input
      if (node.inputs?.text || (node._meta?.title && (
          node._meta.title.toLowerCase().includes('input') || 
          node._meta.title.toLowerCase().includes('prompt')
        ))) {
        addTextInput(nodeId, node);
      }
    }
    
    // Check for seed inputs
    if ((node.class_type === 'KSampler' || node.class_type === 'KSamplerAdvanced') && 
        (node.inputs?.seed !== undefined || (node._meta?.title && node._meta.title.toLowerCase().includes('user')))) {
      addSeedInput(nodeId, node);
    }
    
    // Check for number inputs
    if (node.class_type === 'NumberInput' || 
        (node._meta?.title && node._meta.title.toLowerCase().includes('user'))) {
      addNumberInput(nodeId, node);
    }
  }
  
  // If we found user inputs, show the container
  if (userInputsContainer.children.length > 0) {
    userInputsContainer.classList.remove('hidden');
  } else {
    // Add a message if no inputs were found
    const message = document.createElement('p');
    message.textContent = "No user inputs detected in this workflow.";
    userInputsContainer.appendChild(message);
    userInputsContainer.classList.remove('hidden');
  }
}

// Add text input for user
function addTextInput(nodeId, node) {
  const defaultValue = node.inputs?.text || '';
  const title = node._meta?.title || 'Text Input';
  
  const inputGroup = document.createElement('div');
  inputGroup.className = 'mb-4';
  
  const label = document.createElement('label');
  label.className = 'block text-sm font-medium text-gray-700 mb-1';
  label.textContent = title;
  label.htmlFor = `input-${nodeId}`;
  
  const input = document.createElement('input');
  input.type = 'text';
  input.id = `input-${nodeId}`;
  input.className = 'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500';
  input.value = defaultValue;
  input.addEventListener('input', () => {
    // Store the input value
    if (!workflowUserInputs[nodeId]) {
      workflowUserInputs[nodeId] = {};
    }
    workflowUserInputs[nodeId].text = input.value;
  });
  
  // Initialize the input value
  if (!workflowUserInputs[nodeId]) {
    workflowUserInputs[nodeId] = {};
  }
  workflowUserInputs[nodeId].text = defaultValue;
  
  inputGroup.appendChild(label);
  inputGroup.appendChild(input);
  userInputsContainer.appendChild(inputGroup);
}

// Add seed input for user
function addSeedInput(nodeId, node) {
  const defaultValue = node.inputs?.seed || Math.floor(Math.random() * 1000000);
  const title = node._meta?.title || 'Seed';
  
  const inputGroup = document.createElement('div');
  inputGroup.className = 'mb-4';
  
  const label = document.createElement('label');
  label.className = 'block text-sm font-medium text-gray-700 mb-1';
  label.textContent = title;
  label.htmlFor = `input-${nodeId}`;
  
  const inputContainer = document.createElement('div');
  inputContainer.className = 'flex gap-2';
  
  const input = document.createElement('input');
  input.type = 'number';
  input.id = `input-${nodeId}`;
  input.className = 'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500';
  input.value = defaultValue;
  input.min = 0;
  input.max = 4294967295;
  input.addEventListener('input', () => {
    // Store the input value
    if (!workflowUserInputs[nodeId]) {
      workflowUserInputs[nodeId] = {};
    }
    workflowUserInputs[nodeId].seed = parseInt(input.value, 10);
  });
  
  const randomButton = document.createElement('button');
  randomButton.className = 'mt-1 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500';
  randomButton.innerHTML = `
    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  `;
  randomButton.title = 'Generate random seed';
  randomButton.addEventListener('click', () => {
    const randomSeed = Math.floor(Math.random() * 4294967295);
    input.value = randomSeed;
    
    // Store the input value
    if (!workflowUserInputs[nodeId]) {
      workflowUserInputs[nodeId] = {};
    }
    workflowUserInputs[nodeId].seed = randomSeed;
  });
  
  // Initialize the input value
  if (!workflowUserInputs[nodeId]) {
    workflowUserInputs[nodeId] = {};
  }
  workflowUserInputs[nodeId].seed = defaultValue;
  
  inputContainer.appendChild(input);
  inputContainer.appendChild(randomButton);
  
  inputGroup.appendChild(label);
  inputGroup.appendChild(inputContainer);
  userInputsContainer.appendChild(inputGroup);
}

// Add number input for user
function addNumberInput(nodeId, node) {
  const defaultValue = node.inputs?.value || 0;
  const title = node._meta?.title || 'Number Input';
  
  const inputGroup = document.createElement('div');
  inputGroup.className = 'mb-4';
  
  const label = document.createElement('label');
  label.className = 'block text-sm font-medium text-gray-700 mb-1';
  label.textContent = title;
  label.htmlFor = `input-${nodeId}`;
  
  const input = document.createElement('input');
  input.type = 'number';
  input.id = `input-${nodeId}`;
  input.className = 'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500';
  input.value = defaultValue;
  input.step = 'any';
  input.addEventListener('input', () => {
    // Store the input value
    if (!workflowUserInputs[nodeId]) {
      workflowUserInputs[nodeId] = {};
    }
    workflowUserInputs[nodeId].value = parseFloat(input.value);
  });
  
  // Initialize the input value
  if (!workflowUserInputs[nodeId]) {
    workflowUserInputs[nodeId] = {};
  }
  workflowUserInputs[nodeId].value = defaultValue;
  
  inputGroup.appendChild(label);
  inputGroup.appendChild(input);
  userInputsContainer.appendChild(inputGroup);
}

// Event listeners
if (workflowUploadForm) {
  workflowUploadForm.addEventListener('submit', handleWorkflowUpload);
}

if (workflowUploadInput) {
  workflowUploadInput.addEventListener('change', async (event) => {
    // Auto-fill name from filename if not already filled
    if (!workflowNameInput.value) {
      const file = workflowUploadInput.files[0];
      if (file) {
        workflowNameInput.value = file.name.replace('.json', '');
      }
    }
    
    // Automatically submit the form when a file is selected
    if (workflowUploadInput.files.length > 0) {
      const submitEvent = new Event('submit');
      workflowUploadForm.dispatchEvent(submitEvent);
    }
  });
}

if (imageUploadInput) {
  imageUploadInput.addEventListener('change', handleImageUpload);
}

if (executeButton) {
  executeButton.addEventListener('click', executeWorkflow);
}

if (regenerateButton) {
  regenerateButton.addEventListener('click', executeWorkflow);
}

if (newWorkflowButton) {
  newWorkflowButton.addEventListener('click', () => {
    // Reset selection
    selectedWorkflowId = null;
    workflowData = null;
    
    // Hide containers
    workflowContainer.classList.add('hidden');
    resultContainer.classList.add('hidden');
    
    // Scroll to workflow list
    workflowList.scrollIntoView({ behavior: 'smooth' });
  });
}

if (downloadButton) {
  downloadButton.addEventListener('click', () => {
    // The download attribute on the anchor tag handles this
    if (resultImage.src) {
      const link = document.createElement('a');
      link.href = resultImage.src;
      link.download = `comfyui-result-${Date.now()}.png`;
      link.click();
    }
  });
}

// Update API session info
function updateApiSession(message) {
  const timestamp = new Date().toLocaleTimeString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  // Update both desktop and mobile logs
  const apiSession = document.getElementById('api-session');
  const apiSessionMobile = document.getElementById('api-session-mobile');
  
  if (apiSession) {
    apiSession.textContent += logMessage;
    apiSession.scrollTop = apiSession.scrollHeight;
  }
  
  if (apiSessionMobile) {
    apiSessionMobile.textContent += logMessage;
    apiSessionMobile.scrollTop = apiSessionMobile.scrollHeight;
  }
} 