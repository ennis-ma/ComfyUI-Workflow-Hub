# Installation Guide for ComfyUI Workflow Hub

## Prerequisites

ComfyUI Workflow Hub requires Node.js to run. The error you're seeing indicates that Node.js is not installed on your system.

### Installing Node.js

1. **Windows**:
   - Download the Node.js installer from [nodejs.org](https://nodejs.org/)
   - Choose the LTS (Long Term Support) version for stability
   - Run the installer and follow the installation wizard
   - Make sure to check the option to add Node.js to your PATH
   - Restart your command prompt or PowerShell after installation

2. **macOS**:
   - Download the Node.js installer from [nodejs.org](https://nodejs.org/)
   - Choose the LTS version
   - Run the installer and follow the instructions
   - Alternatively, use Homebrew: `brew install node`

3. **Linux**:
   - Use your distribution's package manager:
     - Ubuntu/Debian: `sudo apt update && sudo apt install nodejs npm`
     - Fedora: `sudo dnf install nodejs`
     - Arch Linux: `sudo pacman -S nodejs npm`

### Verifying Installation

After installing Node.js, verify it's working by opening a new command prompt or terminal and running:

```
node --version
npm --version
```

Both commands should display version numbers if the installation was successful.

## Installing ComfyUI Workflow Hub

Once Node.js is installed, you can proceed with the installation:

1. Clone the repository (if you haven't already):
   ```
   git clone https://github.com/ennis-ma/ComfyUI-Workflow-Hub.git
   cd ComfyUI-Workflow-Hub
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file by copying the example:
   ```
   cp .env.example .env
   ```
   Then edit the `.env` file with your configuration.

4. Start the server:
   ```
   npm start
   ```

5. Open your browser and navigate to `http://localhost:3000`

## Troubleshooting

### "npm not recognized" after installation

If you've installed Node.js but still get the "npm not recognized" error:

1. Make sure you've restarted your command prompt or PowerShell
2. Check if Node.js was added to your PATH:
   - Open System Properties > Advanced > Environment Variables
   - Look for Node.js in the Path variable
   - If missing, add the Node.js installation directory (typically `C:\Program Files\nodejs\`)

### Using Node.js with Python virtual environments

If you're using Python virtual environments and want to keep Node.js separate:

1. Consider using [nvm (Node Version Manager)](https://github.com/nvm-sh/nvm) for Unix/macOS or [nvm-windows](https://github.com/coreybutler/nvm-windows) for Windows
2. This allows you to manage multiple Node.js versions without conflicts

### Alternative: Running with Docker

If you prefer not to install Node.js directly, you can use Docker:

```bash
# Build the Docker image
docker build -t comfyui-workflow-hub .

# Run the container
docker run -p 3000:3000 -e COMFYUI_URL=http://host.docker.internal:8188 comfyui-workflow-hub
```

## Need More Help?

If you're still having issues, please open an issue on GitHub with details about your system and the exact error messages you're seeing. 