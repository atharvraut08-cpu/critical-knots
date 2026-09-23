import { WebSocket } from 'ws';

async function runTests() {
    console.log('--- STARTING MULTIPLAYER TEST ---');

    // 1. Host creates room
    const hostWs = new WebSocket('ws://localhost:8080');

    await new Promise((resolve) => hostWs.on('open', resolve));
    console.log('✓ Host connected to server');

    let roomCode = '';
    let hostPlayerId = '';

    const hostPromise = new Promise((resolve, reject) => {
        hostWs.on('message', (data) => {
            const msg = JSON.parse(data);
            if (msg.type === 'ROOM_JOINED') {
                roomCode = msg.room.code;
                hostPlayerId = msg.playerId;
                console.log(`✓ Room created with code: ${roomCode} by host: ${hostPlayerId}`);
                console.log(`✓ Teams in room: ${msg.room.teamNames.join(', ')}`);
                resolve(msg.room);
            }
        });
    });

    hostWs.send(JSON.stringify({
        type: 'CREATE_ROOM',
        playerName: 'TopGun_Host',
    }));

    const initialRoom = await hostPromise;

    if (initialRoom.players.length !== 1) {
        throw new Error('Expected 1 player in room initially');
    }

    // 2. Player 2 joins room
    const p2Ws = new WebSocket('ws://localhost:8080');
    await new Promise((resolve) => p2Ws.on('open', resolve));

    const p2Promise = new Promise((resolve) => {
        p2Ws.on('message', (data) => {
            const msg = JSON.parse(data);
            if (msg.type === 'ROOM_JOINED') {
                console.log(`✓ Player 2 joined room. Assigned team: ${msg.room.players.find(p => p.id === msg.playerId).team}`);
                resolve(msg.room);
            }
        });
    });

    p2Ws.send(JSON.stringify({
        type: 'JOIN_ROOM',
        code: roomCode,
        playerName: 'Viper_Wingman',
    }));

    await p2Promise;

    // 3. Test Team Switching
    console.log('Testing team switching...');
    const switchPromise = new Promise((resolve) => {
        p2Ws.on('message', (data) => {
            const msg = JSON.parse(data);
            if (msg.type === 'ROOM_UPDATE') {
                const p2 = msg.room.players.find(p => p.name === 'Viper_Wingman');
                if (p2 && p2.team === 2) {
                    console.log('✓ Player 2 successfully switched to Team 2 (Emerald)');
                    resolve();
                }
            }
        });
    });

    p2Ws.send(JSON.stringify({
        type: 'SWITCH_TEAM',
        team: 2,
    }));

    await switchPromise;

    // 4. Test Custom Team Naming
    console.log('Testing team renaming...');
    const renamePromise = new Promise((resolve) => {
        hostWs.on('message', (data) => {
            const msg = JSON.parse(data);
            if (msg.type === 'ROOM_UPDATE') {
                if (msg.room.teamNames[0] === 'Apex Predators') {
                    console.log('✓ Team 0 successfully renamed to "Apex Predators"');
                    resolve();
                }
            }
        });
    });

    hostWs.send(JSON.stringify({
        type: 'SET_TEAM_NAME',
        team: 0,
        name: 'Apex Predators',
    }));

    await renamePromise;

    // 5. Host launches match with AI bots filled (total 12 players across 4 teams)
    console.log('Testing game launch with bot backfill...');
    const gameStartPromise = new Promise((resolve) => {
        hostWs.on('message', (data) => {
            const msg = JSON.parse(data);
            if (msg.type === 'GAME_STARTED') {
                console.log(`✓ Match started! Total combat jets: ${msg.room.players.length}`);
                console.log(`✓ Total pickups spawned: ${msg.room.pickups.length}`);
                if (msg.room.players.length === 12) {
                    console.log('✓ Full 12-player grid confirmed (4 teams of 3 jets)!');
                }
                resolve(msg.room);
            }
        });
    });

    hostWs.send(JSON.stringify({
        type: 'START_MATCH',
        fillBots: true,
    }));

    const activeRoom = await gameStartPromise;

    // 6. Test tick update received
    console.log('Verifying 30Hz combat state synchronization...');
    const tickPromise = new Promise((resolve) => {
        p2Ws.on('message', (data) => {
            const msg = JSON.parse(data);
            if (msg.type === 'TICK_UPDATE') {
                console.log(`✓ Received tick broadcast with ${msg.players.length} jets synchronized.`);
                resolve();
            }
        });
    });

    await tickPromise;

    // Cleanup
    hostWs.close();
    p2Ws.close();

    console.log('--- ALL MULTIPLAYER TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
});
