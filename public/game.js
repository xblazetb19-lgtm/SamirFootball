// ═══════════════════════════════════════════════
//  FOOT INSOLITE — game.js
// ═══════════════════════════════════════════════
var _phaserGame = null;

function initGame(pseudo, team, celeb, dribble, socket) {
    if (window._phaserGame) { window._phaserGame.destroy(true); window._phaserGame = null; }
    document.addEventListener('contextmenu', e => e.preventDefault());
    const cfg = {
        type: Phaser.AUTO, width: GW, height: GH,
        parent: 'game-container',
        backgroundColor: '#1a5c1a',
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        physics: { default:'arcade', arcade:{ gravity:{y:0}, debug:false } },
        scene: { preload:_preload, create:function(){ _create.call(this,pseudo,team,celeb,dribble,socket); }, update:_update }
    };
    window._phaserGame = new Phaser.Game(cfg);
}

// ── CONSTANTES ──────────────────────────────────
const GW=1000, GH=580, PS=56, BS=28;
const BUT_R={x:0,y:210,w:38,h:160};
const BUT_B={x:962,y:210,w:38,h:160};
const SPAWN_R={x:140,y:290}, SPAWN_B={x:860,y:290}, SPAWN_BALL={x:500,y:290};
const CONTACT_R=50; // zone de contact pour tirer

// ── ÉTAT ────────────────────────────────────────
var _p, _b, _walls;
var _ang=0, _stamina=100;
var _lobOn=false, _lobZ=0, _lobVZ=0;
var _dOn=false, _dPhase=0, _dT=0, _dCD=false, _dCDt=0;
var _celeb=false, _cObjs=[];
var _gCD=false, _sR=0, _sB=0;
var _sTxt, _pTxt, _rTxt;
var _gSta, _gDrib, _gPow, _gEff, _gLob, _gPush;
var _sock, _team, _pseudo, _myceleb, _mydrib;
var _remotes={}, _netT=0, _pend=null;
var _cur, _spc, _eKey, _fKey, _sft, _yKey;
var _emoteList=['🐒','👧','⛷️','👷','🍿','🍟','🥨','🧨','🎐','🎢','🎪','🛻','🚙','🛴','💫','㊗️','🧜','🎉','🔥','💎'];
var _emoteIndex=0, _emoteCD=false;

// Jauges
var _chargePow=0,  _isChargingPow=false;   // ESPACE : tir puissant
var _chargeEff=0,  _isChargingEff=false;   // CLIC   : tir courbe
var _chargeLob=0,  _isChargingLob=false;   // E      : lob
var _shootCD=false, _shootCDt=0;
var _ballMaster=false; // ce client contrôle la balle
var _ballMasterTimer=0;
var _pushCD=false, _pushCDt=0, PUSH_CD=10000;
var _emoteCD=false, _emoteCDt=0, EMOTE_CD=3000;
var _yKey;
var _curve=0, _efxVal=0;

const DRIB={
    virgule:{phases:4,dur:160,label:'〽️ VIRGULE'},
    roulette:{phases:6,dur:120,label:'🌀 ROULETTE'},
    crochet:{phases:3,dur:130,label:'🦶 CROCHET'},
    passement:{phases:4,dur:140,label:'👟 PASSEMENT'},
    spin:{phases:6,dur:100,label:'🔄 SPIN'},
    sombrero:{phases:3,dur:180,label:'🎩 SOMBRERO'},
    petitpont:{phases:3,dur:150,label:'🚪 PETIT PONT'},
    doublecontact:{phases:4,dur:110,label:'⚡ DBL'},
    feinte:{phases:2,dur:200,label:'🎭 FEINTE'},
    rainbow:{phases:5,dur:130,label:'🌈 RAINBOW'},
    elastico:{phases:4,dur:130,label:'🌪️ ELASTICO'},
    stepover:{phases:4,dur:120,label:'💫 STEP OVER'},
    hocus:{phases:5,dur:150,label:'🎪 HOCUS POCUS'},
    akka:{phases:4,dur:110,label:'🔃 AKKA'},
    berba:{phases:3,dur:160,label:'🎯 BERBA SPIN'},
    snake:{phases:6,dur:90,label:'🐍 SNAKE'},
    scoop:{phases:3,dur:140,label:'🥄 SCOOP'},
    lamamou:{phases:5,dur:130,label:'🦾 LA MAMOU'},
    rabona:{phases:3,dur:180,label:'🎸 RABONA'},
    heel:{phases:3,dur:120,label:'👡 HEEL FLICK'},
    maradona:{phases:6,dur:140,label:'🕺 MARADONA'},
    cr7:{phases:4,dur:110,label:'⚡ CR7 CHOP'},
    neymar:{phases:4,dur:130,label:'🌟 NEYMAR'},
    mbappe:{phases:3,dur:100,label:'💨 MBAPPE'},
    pogba:{phases:4,dur:150,label:'💃 POGBA'},
    iniesta:{phases:5,dur:130,label:'🧠 INIESTA'},
    zizou:{phases:6,dur:140,label:'👑 ZIZOU 360'},
    ronaldinho:{phases:4,dur:160,label:'😁 RONALDINHO'},
    pele:{phases:4,dur:150,label:'🏆 PELÉ'},
    messi:{phases:5,dur:120,label:'🐐 MESSI'},
};

function _preload(){
    this.load.image('ballon','assets/Ballon.png');
    for(let i=0;i<=5;i++) this.load.image('J'+i,'assets/J'+i+'.png');
}

function _create(pseudo,team,celeb,drib,socket){
    _sock=socket;_team=team;_pseudo=pseudo;_myceleb=celeb;_mydrib=drib;
    _sR=0;_sB=0;_celeb=false;_gCD=false;_lobOn=false;_dOn=false;
    _chargePow=0;_chargeEff=0;_chargeLob=0;
    _isChargingPow=false;_isChargingEff=false;_isChargingLob=false;
    _shootCD=false;_curve=0;_efxVal=0;
    _remotes={};_pend=null;_stamina=100;_ang=0;
    _ballMaster=(team==='rouge'); // rouge maître par défaut

    _drawField(this);
    this.physics.world.setBounds(0,0,GW,GH);

    // Murs
    _walls=this.physics.add.staticGroup();
    _aw(this,_walls,0,0,GW,4);_aw(this,_walls,0,GH-4,GW,4);
    _aw(this,_walls,0,0,4,BUT_R.y);_aw(this,_walls,0,BUT_R.y+BUT_R.h,4,GH-BUT_R.y-BUT_R.h);
    _aw(this,_walls,GW-4,0,4,BUT_B.y);_aw(this,_walls,GW-4,BUT_B.y+BUT_B.h,4,GH-BUT_B.y-BUT_B.h);

    // Anims
    if(!this.anims.exists('wr')){
        this.anims.create({key:'wr',frames:[{key:'J0'},{key:'J1'},{key:'J2'}],frameRate:8,repeat:-1});
        this.anims.create({key:'ir',frames:[{key:'J0'}],frameRate:1,repeat:-1});
        this.anims.create({key:'wb',frames:[{key:'J3'},{key:'J4'},{key:'J5'}],frameRate:8,repeat:-1});
        this.anims.create({key:'ib',frames:[{key:'J3'}],frameRate:1,repeat:-1});
    }

    // Joueur
    const sp=team==='rouge'?SPAWN_R:SPAWN_B;
    _p=this.physics.add.sprite(sp.x,sp.y,team==='rouge'?'J0':'J3');
    _p.setDisplaySize(PS,PS).setCollideWorldBounds(false).setDepth(5); // peut sortir pour débloquer

    // Ballon — rebondit librement
    _b=this.physics.add.image(SPAWN_BALL.x,SPAWN_BALL.y,'ballon');
    _b.setDisplaySize(BS,BS).setCollideWorldBounds(true); // balle ne sort jamais
    _b.setBounce(0.75).setDrag(40).setDepth(5).setMaxVelocity(1400,1400);

    this.physics.add.collider(_p,_walls);
    this.physics.add.collider(_b,_walls);
    // Contact joueur/balle : petite impulsion naturelle
    this.physics.add.collider(_p,_b,_onContact,null,this);

    // Clavier
    _cur=this.input.keyboard.addKeys({up:'Z',down:'S',left:'Q',right:'D'});
    _spc=this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    _eKey=this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    _fKey=this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    _yKey=this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Y);
    _sft=this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    _yKey=this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Y);
    _yKey.on('down',()=>{ _doEmote(this); });

    // ESPACE maintenu = charge tir puissant, relâché = tire
    _spc.on('down', ()=>{ if(_inR()&&!_dOn&&!_shootCD) _isChargingPow=true; });
    _spc.on('up',   ()=>{ if(_isChargingPow&&_inR()&&!_dOn){ _doShoot(this); } _isChargingPow=false; _chargePow=0; });

    // E maintenu = charge lob, relâché = lob
    _eKey.on('down',()=>{ if(_inR()&&!_dOn&&!_lobOn&&!_shootCD) _isChargingLob=true; });
    _eKey.on('up',  ()=>{ if(_isChargingLob&&_inR()&&!_dOn&&!_lobOn){ _doLob(this); } _isChargingLob=false; _chargeLob=0; });

    // F = dribble
    _fKey.on('down',()=>{ if(_inR()&&!_dOn&&!_dCD&&_stamina>=20) _startDrib(this); });

    // CLIC gauche maintenu = charge courbe, relâché = tir courbe
    this.input.on('pointerdown', ptr=>{
        if(ptr.leftButtonDown()&&_inR()&&!_dOn&&!_shootCD) _isChargingEff=true;
    });
    this.input.on('pointerup', ptr=>{
        if(_isChargingEff&&_inR()&&!_dOn){ _doShootCurve(this.input.activePointer); }
        _isChargingEff=false; _chargeEff=0;
    });

    window._kc=on=>{ this.input.keyboard.enabled=on; };

    // TOUCHE Y = emote aléatoire
    const yKey=this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Y);
    yKey.on('down',()=>{ _doEmote(this); });

    // CLIC DROIT = push
    this.input.on('pointerdown', ptr=>{
        if(ptr.rightButtonDown()) _doPush(this);
    });
    document.addEventListener('contextmenu', e=>e.preventDefault());

    // Touche Y = emote
    _yKey.on('down',()=>{
        if(_emoteCD) return;
        _emoteCD=true;
        const emote=_emoteList[_emoteIndex%_emoteList.length];
        _emoteIndex++;
        _showEmote(this, emote);
        _sock?.emit('emote',{emote, pseudo:_pseudo});
        setTimeout(()=>_emoteCD=false, 1500);
    });

    // Score UI
    this.add.text(GW/2-90,14,'ROUGE',{fontFamily:'Bebas Neue',fontSize:'14px',color:'#e83030',stroke:'#000',strokeThickness:3}).setOrigin(0.5,0).setDepth(20);
    _sTxt=this.add.text(GW/2,10,'0  -  0',{fontFamily:'Bebas Neue',fontSize:'30px',color:'#fff',stroke:'#000',strokeThickness:5}).setOrigin(0.5,0).setDepth(20);
    this.add.text(GW/2+90,14,'BLEU',{fontFamily:'Bebas Neue',fontSize:'14px',color:'#2e7fff',stroke:'#000',strokeThickness:3}).setOrigin(0.5,0).setDepth(20);
    _pTxt=this.add.text(0,0,pseudo,{fontFamily:'Bebas Neue',fontSize:'11px',color:'#fff',stroke:'#000',strokeThickness:3}).setOrigin(0.5,1).setDepth(9);
    _rTxt=this.add.text(GW/2,GH-8,'',{fontFamily:'Bebas Neue',fontSize:'12px',color:'#2ecc4a',stroke:'#000',strokeThickness:3}).setOrigin(0.5,1).setDepth(22);
    _buildUI(this);
    _setupSock(this,socket);
}

// ── CONTACT ─────────────────────────────────────
function _inR(){
    if(!_p||!_b) return false;
    const dx=_b.x-_p.x, dy=_b.y-_p.y;
    return Math.sqrt(dx*dx+dy*dy)<CONTACT_R;
}

// Collision physique : petite impulsion pour ne pas coller
function _onContact(p,b){
    _becomeMaster();
    const a=Math.atan2(b.y-p.y, b.x-p.x);
    const spd=Math.sqrt(p.body.velocity.x**2+p.body.velocity.y**2);
    // Micro impulsion — balle reste très proche
    const impulse=6+spd*0.06;
    b.setVelocity(
        Math.cos(a)*impulse + p.body.velocity.x*0.22,
        Math.sin(a)*impulse + p.body.velocity.y*0.22
    );
}

// ── SOCKET ──────────────────────────────────────
function _setupSock(scene,socket){
    socket.on('full_state',data=>{ _pend=data; if(_b&&_sTxt){_applyS(scene,socket,data);_pend=null;} });
    socket.on('player_joined',p=>{ if(p.id!==socket.id) _addR(scene,p); });
    socket.on('player_move',data=>{ if(_remotes[data.id]){_remotes[data.id].tx=data.x;_remotes[data.id].ty=data.y;} });
    socket.on('ball_move',data=>{
        if(!_b) return;
        // Vérifie si on est l'autorité (plus proche de la balle)
        const myDist=Math.sqrt((_b.x-_p.x)**2+(_b.y-_p.y)**2);
        let iAm=true;
        Object.values(_remotes).forEach(r=>{
            if(Math.sqrt((_b.x-r.x)**2+(_b.y-r.y)**2)<myDist) iAm=false;
        });
        // Si je suis l'autorité, j'ignore les corrections de l'autre
        if(iAm) return;
        // Sinon j'applique la position du serveur
        const dx=data.x-_b.x, dy=data.y-_b.y;
        const dist=Math.sqrt(dx*dx+dy*dy);
        if(dist>80){
            _b.setPosition(data.x,data.y);
            _b.setVelocity(data.vx||0,data.vy||0);
        } else if(dist>8){
            _b.setPosition(_b.x+dx*0.5,_b.y+dy*0.5);
            _b.setVelocity(data.vx||0,data.vy||0);
        }
    });
    socket.on('goal_scored',({team,scores,scorerPseudo})=>{
        _sR=scores.rouge;_sB=scores.bleu;
        if(_sTxt)_sTxt.setText(_sR+'  -  '+_sB);
        _goalEvt(scene,team,scorerPseudo);
    });
    socket.on('ball_reset',data=>{ if(_b)_b.setPosition(data.x,data.y).setVelocity(0,0); });
    socket.on('player_left',({id})=>{ if(_remotes[id]){try{_remotes[id].s.destroy();}catch(e){}try{_remotes[id].l.destroy();}catch(e){} delete _remotes[id];} });
    socket.on('emote',({id,emote,pseudo})=>{
        // Affiche l'emote au dessus du joueur distant
        const r=_remotes[id];
        if(!r||!window._phaserGame) return;
        const scene=window._phaserGame.scene.scenes[0];
        _showEmoteAt(scene, r.x, r.y, emote);
    });

    socket.on('send_pos',()=>{ if(_p)socket.emit('player_update',{x:Math.round(_p.x),y:Math.round(_p.y),angle:_ang,hasBall:false}); });

    socket.on('player_emote',({id,emote})=>{
        if(_remotes[id]) _showEmote(scene, _remotes[id].x, _remotes[id].y, emote);
    });

    socket.on('player_emote',({id,emote,x,y})=>{
        if(window._phaserGame) _showEmote(window._phaserGame.scene.scenes[0],x,y,emote);
    });

    // Reçoit un push
    socket.on('got_pushed',({dx,dy,force})=>{
        if(!_p) return;
        // Propulse le joueur dans la direction
        _p.setVelocity(dx*force, dy*force);
        // Perd la balle si dribble
        if(_dOn){ _dOn=false; _dCD=true; _dCDt=2800; }
        // Effet visuel
        if(window._phaserGame){
            const scene=window._phaserGame.scene.scenes[0];
            const txt=scene.add.text(_p.x,_p.y-50,'💥',{fontSize:'40px'}).setOrigin(0.5).setDepth(30);
            scene.tweens.add({targets:txt,y:txt.y-50,alpha:0,duration:600,onComplete:()=>txt.destroy()});
            scene.cameras.main.shake(200,0.008);
        }
    });
}

function _applyS(scene,socket,{players,ball:bd,scores}){
    if(!_b||!_sTxt)return;
    _sR=scores.rouge;_sB=scores.bleu;_sTxt.setText(_sR+'  -  '+_sB);
    if(bd)_b.setPosition(bd.x,bd.y).setVelocity(bd.vx||0,bd.vy||0);
    const ids=new Set(Object.values(players).map(p=>p.id));
    Object.keys(_remotes).forEach(id=>{ if(!ids.has(id)){try{_remotes[id].s.destroy();}catch(e){}try{_remotes[id].l.destroy();}catch(e){} delete _remotes[id];} });
    Object.values(players).forEach(p=>{
        if(p.id===socket.id)return;
        if(!_remotes[p.id])_addR(scene,p);
        else if(Math.abs(p.x-_remotes[p.id].tx)>2||Math.abs(p.y-_remotes[p.id].ty)>2){_remotes[p.id].tx=p.x;_remotes[p.id].ty=p.y;}
    });
}
function _addR(scene,p){
    if(_remotes[p.id]){try{_remotes[p.id].s.destroy();}catch(e){}try{_remotes[p.id].l.destroy();}catch(e){}}
    const sx=p.x||(p.team==='rouge'?SPAWN_R.x:SPAWN_B.x),sy=p.y||SPAWN_BALL.y;
    const s=scene.add.sprite(sx,sy,p.team==='rouge'?'J0':'J3');s.setDisplaySize(PS,PS).setDepth(4);
    const l=scene.add.text(sx,sy-PS/2-4,p.pseudo||'?',{fontFamily:'Bebas Neue',fontSize:'11px',color:p.team==='rouge'?'#ff8888':'#88aaff',stroke:'#000',strokeThickness:3}).setOrigin(0.5,1).setDepth(9);
    _remotes[p.id]={s,l,x:sx,y:sy,tx:sx,ty:sy,team:p.team};
}

// ── UPDATE ──────────────────────────────────────
function _update(time,delta){
    if(!_p||_celeb)return;
    const dt=delta/1000;

    if(_pend&&_b&&_sTxt){_applyS(this,_sock,_pend);_pend=null;}
    if(_shootCD){_shootCDt-=delta;if(_shootCDt<=0)_shootCD=false;}
    // Timer maître balle
    if(_ballMaster&&_ballMasterTimer>0){
        _ballMasterTimer-=delta;
        if(_ballMasterTimer<=0&&!_inR()) _ballMaster=false;
    }
    if(_pushCD){_pushCDt-=delta;if(_pushCDt<=0)_pushCD=false;}
    if(_emoteCD){_emoteCDt-=delta;if(_emoteCDt<=0)_emoteCD=false;}
    if(_dCD){_dCDt-=delta;if(_dCDt<=0)_dCD=false;}

    // Mouvement
    let vx=0,vy=0;
    if(_cur.left.isDown)vx=-1;if(_cur.right.isDown)vx=1;
    if(_cur.up.isDown)vy=-1;if(_cur.down.isDown)vy=1;
    if(vx&&vy){vx*=0.707;vy*=0.707;}
    const mv=vx||vy;
    const sp=_sft.isDown&&mv&&_stamina>0;
    _p.setVelocity(vx*(sp?205:160),vy*(sp?205:160));
    if(mv){_ang=Math.atan2(vy,vx);_p.anims.play(_team==='rouge'?'wr':'wb',true);}
    else _p.anims.play(_team==='rouge'?'ir':'ib',true);

    // Stamina
    if(sp)_stamina=Math.max(0,_stamina-35*dt);
    else if(!mv)_stamina=Math.min(100,_stamina+18*dt);
    else _stamina=Math.min(100,_stamina+5*dt);

    // Charge les jauges si dans la zone
    const inR=_inR();
    if(_isChargingPow&&inR&&!_dOn) _chargePow=Math.min(1,_chargePow+1.0*dt);
    else if(!_isChargingPow) _chargePow=Math.max(0,_chargePow-2*dt);

    if(_isChargingEff&&inR&&!_dOn) _chargeEff=Math.min(1,_chargeEff+1.0*dt);
    else if(!_isChargingEff) _chargeEff=Math.max(0,_chargeEff-2*dt);

    if(_isChargingLob&&inR&&!_dOn) _chargeLob=Math.min(1,_chargeLob+0.8*dt);
    else if(!_isChargingLob) _chargeLob=Math.max(0,_chargeLob-2*dt);

    // Indicateur
    if(inR&&!_dOn&&!_shootCD){
        if(_isChargingPow) _rTxt.setText('⚡ PUISSANCE '+Math.round(_chargePow*100)+'%').setColor('#ffcc00');
        else if(_isChargingEff) _rTxt.setText('↺ EFFET '+Math.round(_chargeEff*100)+'%').setColor('#44aaff');
        else if(_isChargingLob) _rTxt.setText('⬆ LOB '+Math.round(_chargeLob*100)+'%').setColor('#ffffaa');
        else if(_fKey.isDown&&!_dCD) _rTxt.setText((DRIB[_mydrib]||DRIB.virgule).label).setColor('#f0c040');
        else _rTxt.setText('ESPACE·Tir  CLIC·Courbe  E·Lob  F·Dribble').setColor('rgba(255,255,255,0.3)');
    } else if(!_isChargingPow&&!_isChargingEff&&!_isChargingLob) _rTxt.setText('');

    // Dribble
    if(_dOn){
        _dT-=delta;
        if(_dT<=0){_dPhase++;const c=DRIB[_mydrib]||DRIB.virgule;if(_dPhase>=c.phases)_endDrib();else _dT=c.dur;}
        if(_dOn)_animDrib();
    }

    // Lob
    if(_lobOn){
        _lobVZ-=500*dt;_lobZ+=_lobVZ*dt;
        if(_lobZ<=0){_lobZ=0;_lobVZ=0;_lobOn=false;_b.setScale(BS/_b.width).setDepth(5).setDrag(55);_shootCD=false;}
        else{_b.setScale((BS/_b.width)*(1+(_lobZ/100)*0.5));_b.setDepth(10+_lobZ*0.05);}
    }

    // Courbe balle
    if(!_lobOn&&_curve!==0&&_b.body.speed>50){
        const bvx=_b.body.velocity.x,bvy=_b.body.velocity.y,len=Math.sqrt(bvx*bvx+bvy*bvy);
        if(len>10){const ac=150+_efxVal*(500-150);_b.body.velocity.x+=(-bvy/len*_curve)*ac*dt*Math.min(1,_b.body.speed/200);_b.body.velocity.y+=(bvx/len*_curve)*ac*dt*Math.min(1,_b.body.speed/200);}
    }
    if(!_lobOn){
        _b.setRotation(_b.rotation+_b.body.velocity.x*0.002);
        if(_b.body.speed<15){_curve=0;_efxVal=0;}
    }

    // Remotes
    Object.values(_remotes).forEach(r=>{
        const dx=r.tx-r.x,dy=r.ty-r.y,dist=Math.sqrt(dx*dx+dy*dy);
        if(dist>300){r.x=r.tx;r.y=r.ty;}else{r.x+=dx*0.45;r.y+=dy*0.45;}
        r.s.setPosition(r.x,r.y);r.l.setPosition(r.x,r.y-PS/2-4);
        r.s.anims.play(dist>3?(r.team==='rouge'?'wr':'wb'):(r.team==='rouge'?'ir':'ib'),true);
    });
    // Ramène le joueur si trop loin hors terrain
    if(_p.x < -80) _p.setVelocityX(Math.max(0,_p.body.velocity.x));
    if(_p.x > GW+80) _p.setVelocityX(Math.min(0,_p.body.velocity.x));
    if(_p.y < -80) _p.setVelocityY(Math.max(0,_p.body.velocity.y));
    if(_p.y > GH+80) _p.setVelocityY(Math.min(0,_p.body.velocity.y));
    if(_pTxt)_pTxt.setPosition(_p.x,_p.y-PS/2-4);

    // Réseau
    _netT+=delta;
    if(_netT>=16){
        _netT=0;
        _sock?.emit('player_update',{x:Math.round(_p.x),y:Math.round(_p.y),angle:_ang,hasBall:false});
        // Envoie la balle seulement si on est le plus proche (autorité)
        const distToBall=Math.sqrt((_b.x-_p.x)**2+(_b.y-_p.y)**2);
        let isBallAuthority=true;
        Object.values(_remotes).forEach(r=>{
            const rd=Math.sqrt((_b.x-r.x)**2+(_b.y-r.y)**2);
            if(rd<distToBall) isBallAuthority=false;
        });
        if(isBallAuthority){
            _sock?.emit('ball_update',{x:Math.round(_b.x),y:Math.round(_b.y),vx:Math.round(_b.body.velocity.x),vy:Math.round(_b.body.velocity.y)});
        }
    }

    _updUI();
    if(!_gCD)_checkGoals(this);
}

// ── TIRS VERS CURSEUR ───────────────────────────
function _becomeMaster(){ _ballMaster=true; _ballMasterTimer=3000; }

function _doShoot(scene){
    _becomeMaster();
    const ptr=window._phaserGame.scene.scenes[0].input.activePointer;
    const a=Phaser.Math.Angle.Between(_p.x,_p.y,ptr.x,ptr.y);
    const pow=180+_chargePow*(750-180);
    _curve=0;
    _b.setVelocity(Math.cos(a)*pow, Math.sin(a)*pow);
    _p.setVelocity(-Math.cos(a)*45,-Math.sin(a)*45);
    _shootCD=true;_shootCDt=400;
    _isChargingPow=false;_chargePow=0;
    _sock?.emit('ball_free');
}

function _doShootCurve(ptr){
    _becomeMaster();
    const a=Phaser.Math.Angle.Between(_p.x,_p.y,ptr.x,ptr.y);
    const diff=Phaser.Math.Angle.Wrap(a-_ang);
    _curve=diff>0.1?1:diff<-0.1?-1:(Math.random()<0.5?1:-1);
    _efxVal=_chargeEff;
    const pow=200+_chargeEff*(600-200);
    _b.setVelocity(Math.cos(a)*pow, Math.sin(a)*pow);
    _p.setVelocity(-Math.cos(a)*45,-Math.sin(a)*45);
    _shootCD=true;_shootCDt=400;
    _isChargingEff=false;_chargeEff=0;
    _sock?.emit('ball_free');
}

function _doLob(scene){
    _becomeMaster();
    const ptr=window._phaserGame.scene.scenes[0].input.activePointer;
    const a=Phaser.Math.Angle.Between(_p.x,_p.y,ptr.x,ptr.y);
    const hspd=140+_chargeLob*(280-140);
    _lobOn=true;_lobZ=1;_lobVZ=220+_chargeLob*100;_curve=0;
    _shootCD=true;_shootCDt=2000;
    _b.setVelocity(Math.cos(a)*hspd,Math.sin(a)*hspd);
    _b.setDrag(8);
    _p.setVelocity(-Math.cos(a)*35,-Math.sin(a)*35);
    _isChargingLob=false;_chargeLob=0;
}

// ── DRIBBLES ────────────────────────────────────
function _startDrib(scene){
    _dOn=true;_dPhase=0;
    const c=DRIB[_mydrib]||DRIB.virgule;_dT=c.dur;
    _stamina=Math.max(0,_stamina-20);
    const t=scene.add.text(_p.x,_p.y-60,c.label,{fontFamily:'Bebas Neue',fontSize:'20px',color:'#f0c040',stroke:'#000',strokeThickness:4}).setOrigin(0.5).setDepth(30);
    scene.tweens.add({targets:t,y:t.y-34,alpha:0,duration:650,onComplete:()=>t.destroy()});
}
function _animDrib(){
    const pL=_ang-Math.PI/2,pR=_ang+Math.PI/2;
    const c=DRIB[_mydrib]||DRIB.virgule,t=1-(_dT/c.dur),d=_mydrib;
    let tx=_p.x,ty=_p.y;
    if(d==='virgule'||d==='passement'||d==='crochet'||d==='feinte'||d==='elastico'||d==='heel'||d==='cr7'){
        if(_dPhase===0){tx=_p.x+Math.cos(pL)*34*t;ty=_p.y+Math.sin(pL)*34*t;}
        else if(_dPhase===1){const a=pL+(pR-pL)*t;tx=_p.x+Math.cos(a)*34;ty=_p.y+Math.sin(a)*34;}
        else if(_dPhase===2){tx=_p.x+Math.cos(pR)*34*(1-t)*0.5+Math.cos(_ang)*(26+t*12);ty=_p.y+Math.sin(pR)*34*(1-t)*0.5+Math.sin(_ang)*(26+t*12);}
        else{tx=_p.x+Math.cos(_ang)*30;ty=_p.y+Math.sin(_ang)*30;}
    }else if(d==='roulette'||d==='spin'||d==='maradona'||d==='zizou'||d==='snake'){
        const ao=((_dPhase+t)/c.phases)*Math.PI*2+_ang;tx=_p.x+Math.cos(ao)*34;ty=_p.y+Math.sin(ao)*34;
    }else if(d==='sombrero'||d==='scoop'||d==='rainbow'||d==='pele'){
        tx=_p.x+Math.cos(_ang)*30;ty=_p.y+Math.sin(_ang)*30;
        _b.setScale((BS/_b.width)*(1+Math.sin((_dPhase+t)*Math.PI/c.phases)*0.5));
    }else if(d==='petitpont'||d==='akka'){
        if(_dPhase===0){_b.setAlpha(1-t*0.9);tx=_p.x;ty=_p.y;}
        else if(_dPhase===1){_b.setAlpha(t);tx=_p.x+Math.cos(_ang)*34;ty=_p.y+Math.sin(_ang)*34;}
        else{_b.setAlpha(1);tx=_p.x+Math.cos(_ang)*30;ty=_p.y+Math.sin(_ang)*30;}
    }else if(d==='doublecontact'||d==='stepover'||d==='berba'||d==='pogba'||d==='neymar'||d==='mbappe'){
        const side=_dPhase%2===0?pL:pR;
        tx=_p.x+Math.cos(side)*26*Math.sin(t*Math.PI)+Math.cos(_ang)*_dPhase*6;
        ty=_p.y+Math.sin(side)*26*Math.sin(t*Math.PI)+Math.sin(_ang)*_dPhase*6;
    }else if(d==='hocus'||d==='lamamou'||d==='iniesta'||d==='ronaldinho'||d==='messi'){
        const arc=Math.sin(((_dPhase+t)/c.phases)*Math.PI);
        tx=_p.x+Math.cos(_ang+Math.PI)*24*(1-(_dPhase+t)/c.phases)+Math.cos(_ang)*arc*14;
        ty=_p.y+Math.sin(_ang+Math.PI)*24*(1-(_dPhase+t)/c.phases)+Math.sin(_ang)*arc*14;
        _b.setScale((BS/_b.width)*(1+arc*0.3));
    }else if(d==='rabona'){
        if(_dPhase===0){tx=_p.x+Math.cos(pR)*30*t;ty=_p.y+Math.sin(pR)*30*t;}
        else if(_dPhase===1){tx=_p.x+Math.cos(_ang+Math.PI)*18*t+Math.cos(pL)*18*(1-t);ty=_p.y+Math.sin(_ang+Math.PI)*18*t+Math.sin(pL)*18*(1-t);}
        else{tx=_p.x+Math.cos(_ang)*36*t;ty=_p.y+Math.sin(_ang)*36*t;}
    }else{tx=_p.x+Math.cos(_ang)*30;ty=_p.y+Math.sin(_ang)*30;}
    _b.setPosition(tx,ty);_b.setVelocity(0,0);
}
function _endDrib(){
    _becomeMaster();
    _dOn=false;_dCD=true;_dCDt=2800;
    _b.setAlpha(1).setScale(BS/_b.width);
    _b.setVelocity(Math.cos(_ang)*300,Math.sin(_ang)*300);
}

// ── BUTS ────────────────────────────────────────
function _checkGoals(scene){
    if(!_b||_lobOn)return;
    const bx=_b.x,by=_b.y;
    if(bx<BUT_R.x+BUT_R.w&&by>BUT_R.y&&by<BUT_R.y+BUT_R.h)_sock?.emit('goal',{team:'bleu',scorerPseudo:_pseudo});
    else if(bx>BUT_B.x&&by>BUT_B.y&&by<BUT_B.y+BUT_B.h)    _sock?.emit('goal',{team:'rouge',scorerPseudo:_pseudo});
    // balle ne sort plus (collideWorldBounds=true)
}
function _goalEvt(scene,team,name){
    _gCD=true;_b.setVelocity(0,0);_p.setVelocity(0,0);
    _lobOn=false;_dOn=false;_isChargingPow=false;_isChargingEff=false;_isChargingLob=false;
    _chargePow=0;_chargeEff=0;_chargeLob=0;_curve=0;
    _doCeleb(scene,team,name||_pseudo);
}
function _resetPos(){
    if(!_b||!_p)return;
    _b.setPosition(SPAWN_BALL.x,SPAWN_BALL.y).setVelocity(0,0).setDrag(55).setScale(BS/_b.width).setDepth(5).setAlpha(1);
    const sp=_team==='rouge'?SPAWN_R:SPAWN_B;
    _p.setPosition(sp.x,sp.y).setVelocity(0,0).setDisplaySize(PS,PS);
    _lobOn=false;_lobZ=0;_dOn=false;_shootCD=false;_celeb=false;
    _isChargingPow=false;_isChargingEff=false;_isChargingLob=false;
    _chargePow=0;_chargeEff=0;_chargeLob=0;_curve=0;_efxVal=0;
    if(_rTxt)_rTxt.setText('');
    if(window._phaserGame)window._phaserGame.scene.scenes[0].time.delayedCall(100,()=>{_gCD=false;});
}

// ── CÉLÉBRATIONS ────────────────────────────────
function _doCeleb(scene,team,name){
    _celeb=true;_cObjs=[];
    const col=team==='rouge'?'#e83030':'#2e7fff';
    const t1=scene.add.text(GW/2,GH/2-40,'BUT !',{fontFamily:'Bebas Neue',fontSize:'88px',color:col,stroke:'#000',strokeThickness:10}).setOrigin(0.5).setDepth(30).setScale(0);
    scene.tweens.add({targets:t1,scaleX:1,scaleY:1,duration:280,ease:'Back.Out'});
    const t2=scene.add.text(GW/2,GH/2+54,name.toUpperCase()+' MARQUE !',{fontFamily:'Bebas Neue',fontSize:'22px',color:'#fff',stroke:'#000',strokeThickness:4}).setOrigin(0.5).setDepth(30).setAlpha(0);
    scene.tweens.add({targets:t2,alpha:1,duration:350,delay:180});
    _cObjs.push(t1,t2);
    const c=_myceleb;
    if(c==='cool'){const e=scene.add.text(_p.x,_p.y-20,'😎',{fontSize:'52px'}).setOrigin(0.5).setDepth(32);scene.tweens.add({targets:e,y:e.y-60,scaleX:1.5,scaleY:1.5,duration:400,yoyo:true});_cObjs.push(e);}
    else if(c==='fire'){for(let i=0;i<16;i++){const f=scene.add.text(Phaser.Math.Between(_p.x-50,_p.x+50),_p.y+20,'🔥',{fontSize:Phaser.Math.Between(16,34)+'px'}).setOrigin(0.5).setDepth(32);scene.tweens.add({targets:f,y:f.y-Phaser.Math.Between(70,150),alpha:0,duration:Phaser.Math.Between(500,1000),delay:i*50});_cObjs.push(f);}}
    else if(c==='scroll'){const bg=scene.add.graphics().setDepth(31);bg.fillStyle(0xf5deb3,.95);bg.fillRoundedRect(GW/2-190,GH/2-30,380,60,10);const msg=scene.add.text(GW/2,GH/2,'📜 '+name+' a tout déchiré',{fontFamily:'Georgia',fontSize:'16px',color:'#3a2000'}).setOrigin(0.5).setDepth(32);scene.tweens.add({targets:[bg,msg],scaleX:{from:0,to:1},duration:350,ease:'Back.Out'});_cObjs.push(bg,msg);}
    else if(c==='pick'){const pk=scene.add.text(_p.x,_p.y,'⛏️',{fontSize:'46px'}).setOrigin(0.5).setDepth(32);scene.tweens.add({targets:pk,angle:[-40,40],yoyo:true,repeat:4,duration:110});_cObjs.push(pk);}
    else if(c==='money'){for(let i=0;i<18;i++){const m=scene.add.text(Phaser.Math.Between(80,GW-80),Phaser.Math.Between(60,GH-60),'💵',{fontSize:Phaser.Math.Between(18,36)+'px'}).setOrigin(0.5).setDepth(32).setAlpha(0);scene.tweens.add({targets:m,alpha:1,y:m.y-Phaser.Math.Between(28,70),duration:280,delay:i*55,yoyo:true,hold:240});_cObjs.push(m);}}
    else if(c==='dance'){const e=scene.add.text(_p.x,_p.y,'🕺',{fontSize:'48px'}).setOrigin(0.5).setDepth(32);scene.tweens.add({targets:e,x:e.x+30,angle:20,yoyo:true,repeat:5,duration:150});_cObjs.push(e);}
    else if(c==='salute'){const e=scene.add.text(_p.x,_p.y-10,'🫡',{fontSize:'52px'}).setOrigin(0.5).setDepth(32);scene.tweens.add({targets:e,y:e.y-50,alpha:0,duration:1200});_cObjs.push(e);}
    else if(c==='dab'){const e=scene.add.text(_p.x,_p.y,'🤙',{fontSize:'52px'}).setOrigin(0.5).setDepth(32);scene.tweens.add({targets:e,angle:-30,scaleX:1.6,scaleY:1.6,duration:300,yoyo:true,repeat:2});_cObjs.push(e);}
    else if(c==='robot'){const e=scene.add.text(_p.x,_p.y,'🤖',{fontSize:'52px'}).setOrigin(0.5).setDepth(32);scene.tweens.add({targets:e,x:e.x+20,yoyo:true,repeat:6,duration:100,ease:'Stepped'});_cObjs.push(e);}
    else if(c==='kiss'){for(let i=0;i<10;i++){const h=scene.add.text(Phaser.Math.Between(_p.x-60,_p.x+60),_p.y,'💋',{fontSize:'24px'}).setOrigin(0.5).setDepth(32);scene.tweens.add({targets:h,y:h.y-Phaser.Math.Between(40,100),alpha:0,duration:800,delay:i*80});_cObjs.push(h);}}
    else if(c==='muscle'){const e=scene.add.text(_p.x,_p.y,'💪',{fontSize:'52px'}).setOrigin(0.5).setDepth(32).setScale(0);scene.tweens.add({targets:e,scaleX:1.8,scaleY:1.8,duration:400,ease:'Back.Out',yoyo:true,repeat:2});_cObjs.push(e);}
    else if(c==='trophy'){const e=scene.add.text(_p.x,_p.y-10,'🏆',{fontSize:'52px'}).setOrigin(0.5).setDepth(32);scene.tweens.add({targets:e,y:e.y-70,duration:600,yoyo:true,ease:'Sine.InOut'});_cObjs.push(e);}
    else if(c==='crown'){const e=scene.add.text(_p.x,_p.y-30,'👑',{fontSize:'48px'}).setOrigin(0.5).setDepth(32);scene.tweens.add({targets:e,y:e.y-20,alpha:0.2,yoyo:true,repeat:4,duration:200});_cObjs.push(e);}
    else if(c==='rocket'){for(let i=0;i<8;i++){const r=scene.add.text(_p.x+Phaser.Math.Between(-40,40),_p.y,'🚀',{fontSize:'28px'}).setOrigin(0.5).setDepth(32);scene.tweens.add({targets:r,y:r.y-GH,alpha:0,duration:1000,delay:i*100,angle:Phaser.Math.Between(-30,30)});_cObjs.push(r);}}
    else if(c==='lightning'){for(let i=0;i<12;i++){const l=scene.add.text(Phaser.Math.Between(40,GW-40),Phaser.Math.Between(20,GH-20),'⚡',{fontSize:Phaser.Math.Between(18,38)+'px'}).setOrigin(0.5).setDepth(32).setAlpha(0);scene.tweens.add({targets:l,alpha:1,scaleX:1.5,scaleY:1.5,duration:150,delay:i*80,yoyo:true});_cObjs.push(l);}}
    else if(c==='ghost'){const e=scene.add.text(_p.x,_p.y,'👻',{fontSize:'52px'}).setOrigin(0.5).setDepth(32);scene.tweens.add({targets:e,alpha:0,x:e.x+80,duration:800,ease:'Power2'});_cObjs.push(e);}
    else if(c==='ninja'){const e=scene.add.text(_p.x,_p.y,'🥷',{fontSize:'52px'}).setOrigin(0.5).setDepth(32);scene.tweens.add({targets:e,angle:360,x:e.x-80,duration:600,ease:'Power3'});_cObjs.push(e);}
    else if(c==='dragon'){for(let i=0;i<6;i++){const d=scene.add.text(Phaser.Math.Between(50,GW-50),GH,'🐉',{fontSize:'38px'}).setOrigin(0.5).setDepth(32);scene.tweens.add({targets:d,y:-40,duration:1200,delay:i*150,ease:'Power1'});_cObjs.push(d);}}
    else if(c==='volcano'){for(let i=0;i<20;i++){const lv=scene.add.text(_p.x+Phaser.Math.Between(-20,20),_p.y,'🔥',{fontSize:Phaser.Math.Between(14,30)+'px'}).setOrigin(0.5).setDepth(32);const angle=Phaser.Math.Between(-150,-30)*(Math.PI/180);scene.tweens.add({targets:lv,x:lv.x+Math.cos(angle)*Phaser.Math.Between(60,140),y:lv.y+Math.sin(angle)*Phaser.Math.Between(60,140),alpha:0,duration:Phaser.Math.Between(500,1000),delay:i*40});_cObjs.push(lv);}}
    else if(c==='explosion'){const e=scene.add.text(_p.x,_p.y,'💥',{fontSize:'80px'}).setOrigin(0.5).setDepth(32).setScale(0);scene.tweens.add({targets:e,scaleX:3,scaleY:3,alpha:0,duration:600,ease:'Power3'});_cObjs.push(e);}
    else if(c==='diamond'){for(let i=0;i<12;i++){const a=(i/12)*Math.PI*2;const d=scene.add.text(_p.x,_p.y,'💎',{fontSize:'22px'}).setOrigin(0.5).setDepth(32);scene.tweens.add({targets:d,x:_p.x+Math.cos(a)*100,y:_p.y+Math.sin(a)*80,alpha:0,duration:800,delay:i*40});_cObjs.push(d);}}
    else if(c==='alien'){const e=scene.add.text(_p.x,_p.y,'👽',{fontSize:'52px'}).setOrigin(0.5).setDepth(32);scene.tweens.add({targets:e,scaleX:2,scaleY:2,alpha:0,duration:800,ease:'Bounce.Out'});_cObjs.push(e);}
    else if(c==='wizard'){for(let i=0;i<8;i++){const s=scene.add.text(_p.x,_p.y,'✨',{fontSize:Phaser.Math.Between(16,32)+'px'}).setOrigin(0.5).setDepth(32);const a=(i/8)*Math.PI*2;scene.tweens.add({targets:s,x:_p.x+Math.cos(a)*80,y:_p.y+Math.sin(a)*60,alpha:0,duration:900,delay:i*50});_cObjs.push(s);}const e=scene.add.text(_p.x,_p.y,'🧙',{fontSize:'52px'}).setOrigin(0.5).setDepth(33);scene.tweens.add({targets:e,y:e.y-50,alpha:0,duration:1200});_cObjs.push(e);}
    else if(c==='phoenix'){for(let i=0;i<10;i++){const f=scene.add.text(_p.x+Phaser.Math.Between(-60,60),_p.y,'🦅',{fontSize:Phaser.Math.Between(18,36)+'px'}).setOrigin(0.5).setDepth(32);scene.tweens.add({targets:f,y:f.y-GH*0.8,x:f.x+Phaser.Math.Between(-80,80),alpha:0,duration:1100,delay:i*80});_cObjs.push(f);}}
    else if(c==='storm'){for(let i=0;i<16;i++){const s=scene.add.text(Phaser.Math.Between(20,GW-20),Phaser.Math.Between(20,GH-20),'⛈️',{fontSize:Phaser.Math.Between(16,32)+'px'}).setOrigin(0.5).setDepth(32).setAlpha(0);scene.tweens.add({targets:s,alpha:1,duration:200,delay:i*60,yoyo:true,repeat:1});_cObjs.push(s);}}
    else if(c==='star'){for(let i=0;i<14;i++){const a=(i/14)*Math.PI*2,s=scene.add.text(_p.x,_p.y,'🌟',{fontSize:Phaser.Math.Between(14,28)+'px'}).setOrigin(0.5).setDepth(32);scene.tweens.add({targets:s,x:_p.x+Math.cos(a)*Phaser.Math.Between(70,150),y:_p.y+Math.sin(a)*Phaser.Math.Between(50,110),alpha:0,scale:0.1,duration:800,delay:i*30,ease:'Power2'});_cObjs.push(s);}}
    else if(c==='snow'){for(let i=0;i<24;i++){const s=scene.add.text(Phaser.Math.Between(20,GW-20),-10,'❄️',{fontSize:Phaser.Math.Between(12,24)+'px'}).setOrigin(0.5).setDepth(32);scene.tweens.add({targets:s,y:GH+20,x:s.x+Phaser.Math.Between(-40,40),duration:Phaser.Math.Between(800,1600),delay:i*60});_cObjs.push(s);}}
    else if(c==='sakura'){for(let i=0;i<20;i++){const s=scene.add.text(Phaser.Math.Between(20,GW-20),-10,'🌸',{fontSize:Phaser.Math.Between(12,26)+'px'}).setOrigin(0.5).setDepth(32);scene.tweens.add({targets:s,y:GH+20,x:s.x+Phaser.Math.Between(-60,60),angle:Phaser.Math.Between(-180,180),duration:Phaser.Math.Between(900,1800),delay:i*50});_cObjs.push(s);}}
    else if(c==='sword'){for(let i=0;i<6;i++){const sw=scene.add.text(_p.x,_p.y,'⚔️',{fontSize:'40px'}).setOrigin(0.5).setDepth(32).setAngle(i*60);scene.tweens.add({targets:sw,x:_p.x+Math.cos(i*Math.PI/3)*100,y:_p.y+Math.sin(i*Math.PI/3)*80,alpha:0,duration:700,delay:i*80});_cObjs.push(sw);}}
    else if(c==='galaxy'){const e=scene.add.text(GW/2,GH/2,'🌌',{fontSize:'200px'}).setOrigin(0.5).setDepth(28).setAlpha(0);scene.tweens.add({targets:e,alpha:0.4,scaleX:1.5,scaleY:1.5,duration:500,yoyo:true});_cObjs.push(e);}
    else{const e=scene.add.text(_p.x,_p.y-20,'🎉',{fontSize:'52px'}).setOrigin(0.5).setDepth(32);scene.tweens.add({targets:e,y:e.y-60,alpha:0,duration:800});_cObjs.push(e);}

    // Confettis
    const cols=[0xffdd00,0xff4444,0x44aaff,0xffffff,0xff8800,0x44dd44];
    for(let i=0;i<20;i++){const cx=Phaser.Math.Between(40,GW-40);const cf=scene.add.graphics().setDepth(29);cf.fillStyle(Phaser.Utils.Array.GetRandom(cols),1);cf.fillRect(0,0,Phaser.Math.Between(5,10),Phaser.Math.Between(5,10));cf.setPosition(cx,-10);scene.tweens.add({targets:cf,y:GH+20,x:cx+Phaser.Math.Between(-60,60),angle:Phaser.Math.Between(0,360),duration:Phaser.Math.Between(800,1600),delay:Phaser.Math.Between(0,400)});_cObjs.push(cf);}
    scene.tweens.add({targets:_p,scaleX:(PS/_p.width)*1.2,scaleY:(PS/_p.height)*1.2,yoyo:true,repeat:3,duration:140});
    scene.time.delayedCall(2500,()=>{_cObjs.forEach(o=>o.destroy());_cObjs=[];_celeb=false;_resetPos();});
}

// ── UI JAUGES ───────────────────────────────────
function _buildUI(scene){
    const mk=(y,lbl,col)=>{
        scene.add.graphics().setDepth(20).fillStyle(0,0.55).fillRoundedRect(14,y,142,12,4);
        scene.add.graphics().setDepth(22).lineStyle(1.5,col,0.5).strokeRoundedRect(14,y,142,12,4);
        scene.add.text(14,y-13,lbl,{fontFamily:'Rajdhani',fontSize:'9px',color:'#fff',stroke:'#000',strokeThickness:2}).setDepth(20);
        return scene.add.graphics().setDepth(21);
    };
    _gPow =mk(GH-34,'⚡ TIR [ESPACE]',0xffcc00);
    _gEff =mk(GH-60,'↺ COURBE [CLIC]',0x44aaff);
    _gLob =mk(GH-86,'⬆ LOB [E]',0xffffaa);
    _gDrib=mk(GH-112,'🎯 DRIBBLE [F]',0xf0c040);
    _gSta =mk(GH-138,'🏃 ÉNERGIE [SHIFT]',0x44dd44);
    _gPush=mk(GH-164,'💥 PUSH [CLIC DROIT]',0xff4444);
}
function _bar(g,y,pct,col,flash=false){
    g.clear();
    const fw=Math.max(0,138*pct);
    if(!fw)return;
    g.fillStyle(col,1);g.fillRoundedRect(16,y+2,fw,8,3);
    if(flash&&pct>=0.98){g.fillStyle(0xffffff,0.3*Math.sin(Date.now()*0.03)+0.3);g.fillRoundedRect(16,y+2,fw,8,3);}
}
function _updUI(){
    if(!_gPow)return;
    _bar(_gPow, GH-34, _chargePow, _chargePow<0.4?0x44dd44:_chargePow<0.75?0xffcc00:0xff3333, true);
    _bar(_gEff, GH-60, _chargeEff, _chargeEff<0.5?0x44aaff:_chargeEff<0.85?0x2266ff:0xaa44ff, true);
    _bar(_gLob, GH-86, _chargeLob, 0xffffaa, false);
    _bar(_gDrib,GH-112,_dCD?1-(_dCDt/2800):1, _dCD?0xff8800:0xf0c040);
    _bar(_gSta, GH-138,_stamina/100, _stamina>60?0x44dd44:_stamina>30?0xffcc00:0xff3333);
    _bar(_gPush,GH-164,_pushCD?1-(_pushCDt/PUSH_CD):1, _pushCD?0x882222:0xff4444);
}

// ── TERRAIN ─────────────────────────────────────
function _drawField(scene){
    const g=scene.add.graphics();
    g.fillStyle(0x2d7a2d,1);g.fillRect(0,0,GW,GH);
    // Rayures adaptées à la nouvelle taille
    const stripeW=GW/10;
    for(let i=0;i<10;i++){if(i%2===0){g.fillStyle(0x287028,1);g.fillRect(i*stripeW,0,stripeW,GH);}}
    g.lineStyle(2,0xffffff,0.8);
    g.strokeRect(10,10,GW-20,GH-20);
    g.beginPath();g.moveTo(GW/2,10);g.lineTo(GW/2,GH-10);g.strokePath();
    g.strokeCircle(GW/2,GH/2,90);
    g.fillStyle(0xffffff,0.8);g.fillCircle(GW/2,GH/2,4);
    // Surfaces de réparation
    const bw=Math.round(GW*0.13),bh=Math.round(GH*0.38);
    g.strokeRect(10,GH/2-bh/2,bw,bh);g.strokeRect(GW-10-bw,GH/2-bh/2,bw,bh);
    g.fillStyle(0xffffff,0.15);g.fillRect(BUT_R.x,BUT_R.y,BUT_R.w,BUT_R.h);g.fillRect(BUT_B.x,BUT_B.y,BUT_B.w,BUT_B.h);
    g.lineStyle(3,0xffffff,1);g.strokeRect(BUT_R.x,BUT_R.y,BUT_R.w,BUT_R.h);g.strokeRect(BUT_B.x,BUT_B.y,BUT_B.w,BUT_B.h);
    g.setDepth(0);
}
function _aw(scene,group,x,y,w,h){const wall=group.create(x+w/2,y+h/2,'__DEFAULT');wall.setDisplaySize(w,h).setAlpha(0).refreshBody();}
