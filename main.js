const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.webContents.openDevTools(); // Always open dev tools for debugging
}

app.whenReady().then(() => {
  console.log('App is ready');
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle file operations
ipcMain.handle('open-file', async (event, filePath) => {
  console.log('Opening file:', filePath);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { filePath, content };
  } catch (error) {
    console.error('Error reading file:', error);
    return null;
  }
});

ipcMain.handle('save-file', async (event, { filePath, content }) => {
  console.log('Saving file:', filePath);
  try {
    fs.writeFileSync(filePath, content);
    return true;
  } catch (error) {
    console.error('Error saving file:', error);
    return false;
  }
});

ipcMain.handle('delete-file', async (event, filePath) => {
  console.log('Deleting file:', filePath);
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
});

function getAllFiles(dir, fileList = []) {
  console.log('Scanning directory:', dir);
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (file.endsWith('.md')) {
      fileList.push({
        name: file,
        path: filePath
      });
    }
  });
  
  return fileList;
}

ipcMain.handle('get-files', async () => {
  console.log('Getting files...');
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });

    console.log('Dialog result:', result);

    if (!result.canceled) {
      const directory = result.filePaths[0];
      const files = getAllFiles(directory);
      console.log('Found files:', files);
      return {
        directory,
        files
      };
    }
    return null;
  } catch (error) {
    console.error('Error in get-files:', error);
    return null;
  }
}); 