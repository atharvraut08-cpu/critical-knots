import { WebSocket } from 'ws';

async function runVictoryTest() {
    console.log('--- STARTING VICTORY & MATCH CYCLE TEST ---');

    const hostWs = new WebSocket('ws://localhost:8080');
    await new Promise((resolve) => hostWs.on('open', resolve));

    let roomCode = '';
    let hostId = '';

    const hostJoinedPromise = new Promise((resolve) => {
        hostWs.on('message', (raw) => {
            const msg = JSON.parse(raw);
            if (msg.type === 'ROOM_JOINED') {
                roomCode = msg.room.code;
                hostId = msg.playerId;
                resolve(msg);
            }
        });
    });

    hostWs.send(JSON.stringify({ type: 'CREATE_ROOM', playerName: 'AceCommander' }));
    await hostJoinedPromise;
    console.log(`✓ Room created: ${roomCode}`);

    // Start match with bots so host has 9 enemy bots to shoot
    let roomData = null;
    const matchStartedPromise = new Promise((resolve) => {
        hostWs.on('message', (raw) => {
            const msg = JSON.parse(raw);
            if (msg.type === 'GAME_STARTED') {
                roomData = msg.room;
                resolve(msg);
            }
        });
    });

    hostWs.send(JSON.stringify({ type: 'START_MATCH', fillBots: true }));
    await matchStartedPromise;
    console.log(`✓ Match started with 12 combat jets!`);

    // Find 5 enemy bots (not team 0)
    const enemyBots = roomData.players.filter(p => p.team !== 0);
    console.log(`✓ Found ${enemyBots.length} enemy targets across opposing squadrons`);

    const victoryPromise = new Promise((resolve) => {
        hostWs.on('message', (raw) => {
            const msg = JSON.parse(raw);
            if (msg.type === 'MATCH_ENDED') {
                console.log(`✓ MATCH_ENDED received! Winner Team: ${msg.winnerTeam} (${msg.winnerTeamName})`);
                console.log(`✓ Team Scores: ${msg.teamScores.join(' - ')}`);
                resolve(msg);
            }
        });
    });

    // Destroy 5 enemy bots
    for (let k = 0; k < 5; k++) {
        const target = enemyBots[k];
        hostWs.send(JSON.stringify({
            type: 'PLAYER_HIT',
            targetId: target.id,
            damage: 100,
            weapon: 'Homing Missile',
        }));
        await new Promise((r) => setTimeout(r, 60));
    }

    const victoryData = await victoryPromise;
    if (victoryData.winnerTeam !== 0) {
        throw new Error(`Expected team 0 to win, got ${victoryData.winnerTeam}`);
    }
    if (victoryData.teamScores[0] < 500) {
        throw new Error(`Expected team 0 score >= 500, got ${victoryData.teamScores[0]}`);
    }
    console.log(`✓ Victory condition successfully triggered at 500 points!`);

    // Test RETURN_TO_LOBBY
    const returnPromise = new Promise((resolve) => {
        hostWs.on('message', (raw) => {
            const msg = JSON.parse(raw);
            if (msg.type === 'ROOM_UPDATE' && msg.room.state === 'lobby') {
                console.log(`✓ Returned to lobby state with score reset to 0`);
                resolve(msg);
            }
        });
    });

    hostWs.send(JSON.stringify({ type: 'RETURN_TO_LOBBY' }));
    await returnPromise;

    hostWs.close();
    console.log('--- ALL VICTORY TESTS COMPLETED SUCCESSFULLY! ---');
}

runVictoryTest().catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
});
