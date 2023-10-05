const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');

// Create an HTTP server for serving the client-side files
const server = http.createServer((req, res) => {
    if (req.url === '/') {
        fs.readFile('index.html', (err, data) => {
            if (err) {
                res.writeHead(500);
                return res.end('Error loading index.html');
            }

            res.writeHead(200, { 'Content-Type': 'text/html' }); // Set proper content type
            res.end(data);
        });
    }
    if (req.url === '/admin') {
        fs.readFile('admin.html', (err, data) => {
            if (err) {
                res.writeHead(500);
                return res.end('Error loading index.html');
            }

            res.writeHead(200, { 'Content-Type': 'text/html' }); // Set proper content type
            res.end(data);
        });
    }
});

// Create a WebSocket server by passing the HTTP server
const wss = new WebSocket.Server({ server });

// Store connected clients and rooms
const clients = new Set();
const rooms = new Map();
const chatRooms = {};

// Function to add a message to a room
function addMessage(roomNumber, message) {
    // Check if the room exists, if not, create it
    if (!(roomNumber in rooms)) {
        rooms[roomNumber] = [];
    }

    // Add the message to the room
    rooms[roomNumber].push(message);
}

// Function to retrieve messages from a room
function getMessages(roomNumber) {
    // Check if the room exists
    if (roomNumber in rooms) {
        return rooms[roomNumber];
    } else {
        return []; // Return an empty array if the room doesn't exist
    }
}

// Define a function to broadcast messages to a room
function broadcastToRoom(roomId, message) {
    if (rooms.has(roomId)) {
        rooms.get(roomId).forEach((client) => {
            client.send(message);
        });
    }
}

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
    clients.add([ws, "anonymous"]);
    const date = new Date();

    // Extract the client's IP address from the request
    const clientIp = req.connection.remoteAddress;
    console.log(`[${date}] New Client connected from IP: ${clientIp}`);

    // Handle messages from clients
    ws.on('message', (message) => {
        const parts = message.toString().split(" ");
        const command = parts[0];
        const content = parts.slice(1).join(" ");

        switch (command) {
            case "USER":
                const name = content;
                clients.forEach((client) => {
                    if (client[0] === ws) {
                        client[1] = name;
                    }
                });
                break;
            case "JOIN":
                const roomId = content;
                if (!roomId || !/^[a-zA-Z0-9]+$/.test(roomId)) {
                    ws.send("Invalid room ID"); // Validate room ID
                    return;
                }
                if (!rooms.has(roomId)) {
                    rooms.set(roomId, new Set());
                }
                rooms.get(roomId).add(ws);
                break;
            case "CREATE":
                const newRoomId = content;
                if (!newRoomId || !/^[a-zA-Z0-9]+$/.test(newRoomId)) {
                    ws.send("Invalid room ID"); // Validate new room ID
                    return;
                }
                if (!rooms.has(newRoomId)) {
                    rooms.set(newRoomId, new Set());
                }
                ws.send(`Room "${newRoomId}" created.`);
                break;
            case "CHAT":
                // Assuming the message format is "CHAT room_id message_content"
                const roomToBroadcast = content.split(" ")[0];
                const chatMessage = content.split(" ").slice(1).join(" ");
                if (!chatMessage || chatMessage.length > 1000) {
                    ws.send("Invalid chat message"); // Validate and limit message length
                    return;
                }

                let username = "anonymous";
                clients.forEach((client) => {
                    if (client[0] === ws) {
                        username = client[1];
                    }
                });

                const formattedMessage = `[${username}] ${chatMessage}`;
                console.log(`Received message "${formattedMessage}" in room ${roomToBroadcast}`);
                addMessage(roomToBroadcast, formattedMessage);
                broadcastToRoom(roomToBroadcast, formattedMessage);
                break;
            default:
                // Handle other commands or invalid commands here
        }
    });

    // Handle client disconnections
    ws.on('close', () => {
        clients.delete(ws);
        // Remove the disconnected client from all rooms
        rooms.forEach((roomClients) => {
            roomClients.delete(ws);
        });
    });
});

// Start the HTTP server on port 3000
server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});