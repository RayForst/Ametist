const { ipcRenderer } = require('electron');
const marked = require('marked');
const path = require('path');

let currentFile = null;
let currentDirectory = null;
let files = [];
const graph = {
    nodes: new vis.DataSet([]),
    edges: new vis.DataSet([])
};

// Initialize graph visualization
const container = document.getElementById('graph-container');
const network = new vis.Network(container, graph, {
    nodes: {
        shape: 'dot',
        size: 16
    },
    edges: {
        width: 2
    },
    physics: {
        stabilization: false,
        barnesHut: {
            gravitationalConstant: -80000,
            springConstant: 0.001,
            springLength: 200
        }
    }
});

// DOM Elements
const editor = document.getElementById('editor-content');
const preview = document.getElementById('preview');
const fileExplorer = document.getElementById('file-explorer');
const currentDirectoryDisplay = document.getElementById('current-directory');
const openFolderBtn = document.getElementById('open-folder');
const newFileBtn = document.getElementById('new-file');
const togglePreviewBtn = document.getElementById('toggle-preview');
const toggleThemeBtn = document.getElementById('toggle-theme');

// Debug function to check if elements exist
function checkElements() {
    console.log('Checking if elements exist:');
    console.log('openFolderBtn:', openFolderBtn);
    console.log('newFileBtn:', newFileBtn);
    console.log('togglePreviewBtn:', togglePreviewBtn);
    console.log('toggleThemeBtn:', toggleThemeBtn);
    console.log('editor:', editor);
    console.log('preview:', preview);
    console.log('fileExplorer:', fileExplorer);
    console.log('currentDirectoryDisplay:', currentDirectoryDisplay);
}

// Theme management
let isDarkMode = false;
const theme = {
    light: {
        nodeColor: '#4a90e2',
        edgeColor: '#4a90e2'
    },
    dark: {
        nodeColor: '#2b579a',
        edgeColor: '#2b579a'
    }
};

// Event Listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');
    checkElements();

    if (openFolderBtn) {
        openFolderBtn.addEventListener('click', async () => {
            console.log('Open folder button clicked');
            try {
                const result = await ipcRenderer.invoke('get-files');
                console.log('Received result from get-files:', result);
                if (result && result.directory) {
                    currentDirectory = result.directory;
                    files = result.files;
                    currentDirectoryDisplay.textContent = currentDirectory;
                    updateFileExplorer();
                    updateGraph();
                }
            } catch (error) {
                console.error('Error in open folder:', error);
            }
        });
    } else {
        console.error('Open folder button not found!');
    }

    if (newFileBtn) {
        newFileBtn.addEventListener('click', () => {
            console.log('New file button clicked');
            if (!currentDirectory) {
                alert('Please open a directory first');
                return;
            }
            const fileName = prompt('Enter file name (with .md extension):');
            if (fileName && fileName.endsWith('.md')) {
                const filePath = path.join(currentDirectory, fileName);
                currentFile = { name: fileName, path: filePath };
                editor.value = '';
                ipcRenderer.invoke('save-file', { filePath, content: '' })
                    .then(() => {
                        files.push(currentFile);
                        updateFileExplorer();
                    })
                    .catch(error => console.error('Error creating file:', error));
            }
        });
    } else {
        console.error('New file button not found!');
    }

    if (togglePreviewBtn) {
        togglePreviewBtn.addEventListener('click', () => {
            console.log('Toggle preview button clicked');
            preview.classList.toggle('hidden');
            editor.classList.toggle('hidden');
            togglePreviewBtn.textContent = preview.classList.contains('hidden') ? 'Show Preview' : 'Show Editor';
        });
    } else {
        console.error('Toggle preview button not found!');
    }

    if (toggleThemeBtn) {
        toggleThemeBtn.addEventListener('click', () => {
            console.log('Toggle theme button clicked');
            isDarkMode = !isDarkMode;
            document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
            toggleThemeBtn.textContent = isDarkMode ? 'Light Mode' : 'Dark Mode';
            updateGraphTheme();
        });
    } else {
        console.error('Toggle theme button not found!');
    }

    if (editor) {
        editor.addEventListener('input', () => {
            if (currentFile) {
                ipcRenderer.invoke('save-file', {
                    filePath: currentFile.path,
                    content: editor.value
                }).catch(error => console.error('Error saving file:', error));
                updateGraph();
                updatePreview();
            }
        });
    } else {
        console.error('Editor not found!');
    }
}

// Initialize
console.log('Initializing application...');
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    setupEventListeners();
    updateGraph();
});

// Functions
function createDirectoryStructure(files) {
    const structure = {};
    
    files.forEach(file => {
        const relativePath = path.relative(currentDirectory, file.path);
        const parts = relativePath.split(path.sep);
        let current = structure;
        
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!current[part]) {
                current[part] = {};
            }
            current = current[part];
        }
        
        current[parts[parts.length - 1]] = file;
    });
    
    return structure;
}

function createDirectoryElement(name, content, level = 0) {
    const isDirectory = typeof content === 'object' && !content.path;
    const element = document.createElement('div');
    element.className = 'directory-item';
    
    if (isDirectory) {
        const nameElement = document.createElement('div');
        nameElement.className = 'name';
        nameElement.innerHTML = `
            <span class="icon">📁</span>
            <span>${name}</span>
        `;
        nameElement.addEventListener('click', () => {
            element.classList.toggle('expanded');
        });
        
        const childrenElement = document.createElement('div');
        childrenElement.className = 'children';
        
        Object.entries(content).forEach(([childName, childContent]) => {
            childrenElement.appendChild(createDirectoryElement(childName, childContent, level + 1));
        });
        
        element.appendChild(nameElement);
        element.appendChild(childrenElement);
    } else {
        const fileElement = document.createElement('div');
        fileElement.className = `file-item ${currentFile && currentFile.path === content.path ? 'active' : ''}`;
        fileElement.innerHTML = `
            <span>${name}</span>
            <span class="delete-file">×</span>
        `;
        
        fileElement.addEventListener('click', async () => {
            try {
                const result = await ipcRenderer.invoke('open-file', content.path);
                if (result) {
                    currentFile = content;
                    editor.value = result.content;
                    updateFileExplorer();
                    updatePreview();
                }
            } catch (error) {
                console.error('Error opening file:', error);
            }
        });
        
        const deleteBtn = fileElement.querySelector('.delete-file');
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete ${name}?`)) {
                try {
                    await ipcRenderer.invoke('delete-file', content.path);
                    files = files.filter(f => f.path !== content.path);
                    if (currentFile && currentFile.path === content.path) {
                        currentFile = null;
                        editor.value = '';
                    }
                    updateFileExplorer();
                    updateGraph();
                } catch (error) {
                    console.error('Error deleting file:', error);
                }
            }
        });
        
        element.appendChild(fileElement);
    }
    
    return element;
}

function updateFileExplorer() {
    fileExplorer.innerHTML = '';
    if (files.length > 0) {
        const structure = createDirectoryStructure(files);
        Object.entries(structure).forEach(([name, content]) => {
            fileExplorer.appendChild(createDirectoryElement(name, content));
        });
    }
}

function updatePreview() {
    if (!preview.classList.contains('hidden')) {
        preview.innerHTML = marked.parse(editor.value);
    }
}

function updateGraph() {
    const nodes = [];
    const edges = new Set();

    files.forEach(file => {
        nodes.push({
            id: file.name,
            label: file.name,
            title: file.name,
            color: isDarkMode ? theme.dark.nodeColor : theme.light.nodeColor
        });

        // Extract links from markdown content
        const content = editor.value;
        const linkRegex = /\[\[([^\]]+)\]\]/g;
        let match;
        while ((match = linkRegex.exec(content)) !== null) {
            const targetFile = match[1];
            if (files.some(f => f.name === targetFile)) {
                edges.add({
                    from: file.name,
                    to: targetFile,
                    color: isDarkMode ? theme.dark.edgeColor : theme.light.edgeColor
                });
            }
        }
    });

    graph.nodes.clear();
    graph.edges.clear();
    graph.nodes.add(nodes);
    graph.edges.add([...edges]);
}

function updateGraphTheme() {
    const currentTheme = isDarkMode ? theme.dark : theme.light;
    graph.nodes.forEach(node => {
        node.color = currentTheme.nodeColor;
    });
    graph.edges.forEach(edge => {
        edge.color = currentTheme.edgeColor;
    });
    network.setData(graph);
} 