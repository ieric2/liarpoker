var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/', function(req, res){
  res.sendFile(__dirname + '/client/index.html');
});
app.use('/client', express.static(__dirname + '/client'));

serv.listen(2000);
console.log("Server started.");

var MAX_LIVES = 5;

var socketList = {};
var turnList = [];
var playerList = {};
var playerArray = [];
var playerCount = 0;
var playerTurn = null;
var freeCards = [ "2H", "3H", "4H", "5H", "6H", "7H", "8H", "9H", "10H", "JH", "QH", "KH", "AH",
              "2D", "3D", "4D", "5D", "6D", "7D", "8D", "9D", "10D", "JD", "QD", "KD", "AD",
              "2S", "3S", "4S", "5S", "6S", "7S", "8S", "9S", "10S", "JS", "QS", "KS", "AS",
              "2C", "3C", "4C", "5C", "6C", "7C", "8C", "9C", "10C", "JC", "QC", "KC", "AC"];
var usedCards = [];

class Player{
  constructor(id){
    this.id = id;
    this.name = 'Player' + id;
    this.lives = MAX_LIVES;
    this.cards = [];
    this.alive = false;
    this.winner = false;

  }
  setName(name){
    this.name = name;
  }
  loseLife(){
    this.lives--;
  }
  dealCards(dealtCards){
    this.cards = dealtCards;
  }
}

function onConnect(socket){
  socketList[socket.id] = socket;
}

function joinGame(socket){
  playerCount++;
  playerList[socket.id] = new Player(socket.id);
  playerList[socket.id].setName(socket.id);
  playerArray.push(socket.id);
  io.emit("addToChat", socket.id + " has joined the game");
  console.log("the number of players is: " + playerCount);
  console.log("my name is: " + playerList[socket.id].name);
}

function onDisconnect(socket){
  delete socketList[socket.id];
  delete playerList[socket.id];
  playerCount--;
}

function startGame(socket){
  drawCards(socket.id);
  playerTurn = Object.keys(playerList)[Math.floor(Math.random() * playerCount)];
  for(i in socketList){
    socketList[i].emit('gameStarting', {cards: playerList[i].cards});
  }
  console.log("game Starting");
}

function drawCards(id){
  for (var i = 0; i < playerCount; i++){
    card = freeCards[Math.floor(Math.random() * freeCards.length)];
    playerList[id].cards.push(card);
    freeCards.splice(freeCards.indexOf(card), 1);
    usedCards.push(card);
  }
}

function playTurn(socket, data){
  console.log("turn for: " + playerTurn);
  if (socket.id == playerTurn){
    console.log("turn played");
    console.log("hand: "+ data[0] + data[1] + data[2]);
    switch(data[0]){
      case "royalFlush":
        message = playerList[socket.id].name + " played a ROYAL FLUSH"; 
        break;
      case "straightFlush":
        message = playerList[socket.id].name + " played a " + data[2] + " " + data[1] + " STRAIGHT FLUSH";
        break;
      case "quad":
        message = playerList[socket.id].name + " played FOUR " + data[1] + "'s";
        break;
      case "fullHouse":
        message = playerList[socket.id].name + " played " + data[1] + "'s FULL of " + data[2] + "'s";
        break;
      case "flush":
        message = playerList[socket.id].name + " played a " + data[1] + " FLUSH";
        break;
      case "straight":
        message = playerList[socket.id].name + " played a " + data[1] + " STRAIGHT";
        break;
      case "triple":
        message = playerList[socket.id].name + " played THREE " + data[1] + "'s";
        break;
      case "twoPair":
        message = playerList[socket.id].name + " played a PAIR of " + data[1] + "'s and a PAIR of " + data[2] + "'s";
        break;
      case "pair":
        message = playerList[socket.id].name + " played a PAIR of " + data[1] + "'s";
        break;
      case "highCard":        
        message = playerList[socket.id].name + " played HIGH CARD " + data[1];
        break;
    }

    turnList.push([playerList[socket.id].name, data[0], data[1], data[2], message]);

    io.emit("addToChat", message);

  }
}

function checkHand(socket, data){
  turn = turnList.pop();
  player = turn[0];
  handType, handSubtype, handSubtype2 = null;
  if(turn.length > 1){
    handType = hand[1];
  }
  if (turn.length > 2){
    handSubtype2 = hand[2];
  }
  if (turn.length > 3){
    handSubtype = hand[3];
  }

}

var io = require('socket.io')(serv, {});
io.sockets.on('connection', function(socket){
  console.log("client connection");
  console.log(socket.id);


  onConnect(socket);

  socket.on("joinGame", function(){
    joinGame(socket);
  });

  socket.on('startGame', function(){
    startGame(socket);
  });

  socket.on('playTurn', function(data){
    playTurn(socket, data);
  });

  socket.on('checkHand', function(){
    //true if there is that hand
    handValidity = checkHand(socket);

    io.emit("resolveDoubt", {handValidity: handValidity})

  })

  socket.on('disconnect', function(){
    onDisconnect(socket);
  });
});