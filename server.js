const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });
const PORT   = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const G = {
    players:  {},
    ball:     { x:500, y:290, vx:0, vy:0 },
    goalies:  { rouge: 290, bleu: 290 },
    scores:   { rouge:0, bleu:0 },
    timer:    300,
    timerMax: 300,
    started:  false,
    goalLock: false
};

io.on('connection', socket => {
    console.log('+ connexion', socket.id);

    socket.on('join', ({ pseudo, team, poste, celeb, dribble, timerMax }) => {
        G.players[socket.id] = {
            id: socket.id, pseudo, team, poste, celeb, dribble,
            x: team === 'rouge' ? 140 : 860,
            y: 290, angle: 0, hasBall: false
        };
        if (Object.keys(G.players).length === 1 && timerMax) {
            G.timerMax = G.timer = timerMax;
        }
        if (Object.keys(G.players).length >= 2 && !G.started) {
            G.started = true;
        }

        socket.broadcast.emit('player_joined', G.players[socket.id]);

        const snap = () => ({
            players: G.players,
            ball: G.ball,
            scores: G.scores,
            timer: G.timer,
            goalies: G.goalies
        });

        io.emit('full_state', snap());
        [300, 800, 1500].forEach(d => {
            setTimeout(() => io.emit('full_state', snap()), d);
        });

        socket.broadcast.emit('send_pos');
        console.log(`${pseudo} (${team}) — ${Object.keys(G.players).length} joueur(s)`);
    });

    socket.on('player_update', data => {
        const p = G.players[socket.id];
        if (!p) return;
        p.x = data.x; p.y = data.y;
        p.angle = data.angle; p.hasBall = data.hasBall;
        socket.broadcast.emit('player_move', {
            id: socket.id, x:data.x, y:data.y,
            angle:data.angle, hasBall:data.hasBall
        });
    });

    // Balle : le client qui envoie est toujours relayé immédiatement
    // Pas de système ballOwner — tout le monde peut envoyer
    socket.on('ball_update', data => {
        G.ball = data;
        // Relay à TOUT le monde sauf l'envoyeur
        socket.broadcast.emit('ball_move', data);
    });

    socket.on('goal', ({ team, scorerPseudo }) => {
        if (G.goalLock) return;
        G.goalLock = true;
        if (team === 'rouge') G.scores.rouge++;
        else G.scores.bleu++;
        G.ball = { x:500, y:290, vx:0, vy:0 };
        G.goalies = { rouge:290, bleu:290 };
        io.emit('goal_scored', { team, scores: G.scores, scorerPseudo });
        setTimeout(() => {
            io.emit('ball_reset', G.ball);
            G.goalLock = false;
        }, 2800);
    });

    socket.on('goalie_move', ({ team, y }) => {
        G.goalies[team] = y;
        socket.broadcast.emit('goalie_move', { team, y });
    });

    socket.on('push', ({ targetId, dx, dy }) => {
        io.to(targetId).emit('got_pushed', { dx, dy, force:380 });
        socket.broadcast.emit('push_effect', { fromId:socket.id, targetId });
    });

    socket.on('chat_msg', ({ pseudo, msg, team }) => {
        io.emit('chat_msg', { pseudo, msg, team });
    });

    socket.on('disconnect', () => {
        const p = G.players[socket.id];
        if (!p) return;
        console.log('- parti:', p.pseudo);
        io.emit('player_left', { id: socket.id, pseudo: p.pseudo });
        delete G.players[socket.id];
        if (Object.keys(G.players).length === 0) {
            G.scores  = { rouge:0, bleu:0 };
            G.ball    = { x:500, y:290, vx:0, vy:0 };
            G.started = false;
            G.timer   = G.timerMax;
        }
    });
});

setInterval(() => {
    if (!G.started || Object.keys(G.players).length === 0) return;
    if (G.timer > 0) {
        G.timer--;
        io.emit('timer_tick', G.timer);
        if (G.timer <= 0) {
            G.started = false;
            io.emit('game_over', { scores: G.scores });
        }
    }
}, 1000);

server.listen(PORT, () => console.log(`✅ http://localhost:${PORT}`));
