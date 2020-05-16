var express = require('express');
var app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
server.listen(process.env.PORT || 8080);
server.setTimeout(2000)

app.get('/', function(req, res){
  console.log("sending index")
  res.sendFile(__dirname + '/client/index.html');
});

app.get('/game/:roomId', function(req, res){
  console.log("sending game")
  res.sendFile(__dirname + '/client/game.html');
})
app.use('/client', express.static(__dirname + '/client'));


console.log("Server started.");

class Player{
  constructor(id){
    this.id = id;
    this.name = 'Player' + id;
    this.lives = MAX_LIVES;
    this.cards = [];
    this.alive = false;
    this.winner = false;
    this.active = true;
  }
  setName(name){
    this.name = name;
  }
}

class Game{
  constructor(id){
    this.gameId = id;
    this.players = [];
    this.numPlayers = 0
    this.turnArray = []
    this.playerTurn = null
    this.freeCards = [ "2H", "3H", "4H", "5H", "6H", "7H", "8H", "9H", "10H", "JH", "QH", "KH", "AH",
              "2D", "3D", "4D", "5D", "6D", "7D", "8D", "9D", "10D", "JD", "QD", "KD", "AD",
              "2S", "3S", "4S", "5S", "6S", "7S", "8S", "9S", "10S", "JS", "QS", "KS", "AS",
              "2C", "3C", "4C", "5C", "6C", "7C", "8C", "9C", "10C", "JC", "QC", "KC", "AC"];
    this.usedCards = [];
    this.gameInProgress = false;
  }
  removePlayer(playerId){
    // console.log(this.players)
    // console.log(playerId)
    const index = this.players.indexOf(playerId)
    if (index > -1){
      this.players.splice(index, 1)
    }
    this.numPlayers--
    console.log("removed")
  }
  addPlayer(playerId){
    this.players.push(playerId)
    this.numPlayers++
    console.log(playerId + " joined game: " + this.gameId)
  }
}

var MAX_LIVES = 5;

var socketList = {};
var playerList = {};
var gameList = {};


var playerArray = [];
var gameArray = [];



function createPlayer(socket){
  playerList[socket.realId] = new Player(socket.realId);
  playerArray.push(socket.realId);
}

function drawCards(gameId){
  gameList[gameId].freeCards = gameList[gameId].freeCards.concat(gameList[gameId].usedCards)
  gameList[gameId].usedCards = []
  
  for (i in playerList){
    playerList[i].cards = [];
    for (var n = MAX_LIVES - playerList[i].lives + 1; n > 0; n--){
      card = gameList[gameId].freeCards[Math.floor(Math.random() * gameList[gameId].freeCards.length)];
      playerList[i].cards.push(card);
      const index = gameList[gameId].freeCards.indexOf(card)
      if (index > -1){
        gameList[gameId].freeCards.splice(index, 1)
        gameList[gameId].usedCards.push(card)
      }
    }
  }
}

function setupRound(gameId){
  gameList[gameId].turnArray = [];
  drawCards(gameId);
  
  if (gameList[gameId].playerTurn == null){
    gameList[gameId].playerTurn = Math.floor(Math.random() * gameList[gameId].players.length);
  }
  console.log(gameList[gameId].playerTurn)


  for(var i in gameList[gameId].players){
    const playerId = gameList[gameId].players[i]
    const playerTurn = gameList[gameId].playerTurn
    io.to(playerId).emit('newRound', {cards: playerList[playerId].cards, newPlayerTurn: gameList[gameId].players[playerTurn], lives: playerList[playerId].lives});
  }
}

//---------- GAME LOGIC -----------//

function checkHand(gameId){
  hand = gameList[gameId].turnArray.pop()
  player = hand[0];
  handType = hand[1];
  handSubtype = hand[2];
  handSubtype2 = hand[3];

  //console.log(usedCards);

  numCounts = {"2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0, "a": 0, "b": 0, "c": 0, "d": 0, "e": 0};
  suitCounts = {"H": 0, "D": 0, "C": 0, "S": 0};

  for (var i = 0; i < gameList[gameId].usedCards.length; i++){
    if (gameList[gameId].usedCards[i].length == 3){
      num = convertCardValue(gameList[gameId].usedCards[i].substring(0, 2));
      suit = gameList[gameId].usedCards[i].charAt(2);
    }
    else{
      num = convertCardValue(gameList[gameId].usedCards[i].charAt(0));
      suit = gameList[gameId].usedCards[i].charAt(1);
    }

    //console.log(num);

    numCounts[num]++;
    suitCounts[suit]++;
  }
  //console.log(numCounts);

  switch (handType){
    case 0: //highcard
    return numCounts[handSubtype] >= 1;
    case 1:   //pair
      return numCounts[handSubtype] >= 2;
    case 2:  //two pair
      return numCounts[handSubtype] >= 2 && numCounts[handSubtype2] >= 2;
    case 3:  //trip
      return numCounts[handSubtype] >= 3;
    case 4:  //straight
      orderedKeys = Object.keys(numCounts);
      startIndex = orderedKeys.indexOf(handSubtype);
      for (var i = 0; i < 5; i++){
        if (startIndex - i == -1){
          if (numCounts['e'] < 1){
            return false;
          }
        }
        else if (numCounts[orderedKeys[startIndex - i]] < 1){
          return false;
        }
      }
      return true;
    case 5:  //flush
      return suitCounts[handSubtype] >= 5;
    case 6:  //full house
      return numCounts[handSubtype] >= 3 && numCounts[handSubtype2] >= 2;
    case 7:  //quad
      return numCounts[handSubtype] >= 4;
    case 8: //straight flush
      orderedKeys = Object.keys(numCounts);
      startIndex = orderedKeys.indexOf(handSubtype);
      for (var i = 0; i < 5; i++){
        if (startIndex - i == -1){
          if (numCounts['e'] < 1){
            return false;
          }
        }
        else if (numCounts[orderedKeys[startIndex - i]] < 1){
          return false;
        }
      }
      return suitCounts[handSubtype] >= 5;
    case 9:  //royalFlush
      orderedKeys = Object.keys(numCounts);
      startIndex = orderedKeys.indexOf('e');
      for (var i = 0; i < 5; i++){
        if (numCounts[orderedKeys[startIndex - i]] < 1){
          return false;
        }
      }
      return suitCounts[handSubtype] >= 5;
  }
}

function checkHandIncreases(data){
  prevHand = gameList[data.gameId].turnArray[gameList[data.gameId].turnArray.length - 1];
  prevHandType = prevHand[1];
  prevHandSubtype = prevHand[2];
  prevHandSubtype2 = prevHand[3];

  handType = data[0];
  //console.log(handType);
  //console.log(prevHandType);
  if (handType < prevHandType){
    return false;
  }
  else if (handType > prevHandType){
    return true;
  }
  else{
    switch(prevHandType){
      case 9: //royalFlush
        return false;
      case 8: //straightFlush
        return prevHandSubtype2 < data[2];
      case 7: //quad
        return prevHandSubtype < data[1];
      case 6: // fullHouse
        return (prevHandSubtype < data[1]) || (prevHandSubtype == data[1] && prevHandSubtype2 < data[2]);
      case 5: // flush
        return false;
      case 4: // straight
        return prevHandSubtype < data[1];
      case 3: //triple
        return prevHandSubtype < data[1];
      case 2: //twoPair
        return  (Math.max(prevHandSubtype, prevHandSubtype2) < Math.max(data[1], data[2])) || 
                (Math.max(prevHandSubtype, prevHandSubtype2) == Math.max(data[1], data[2]) && Math.min(prevHandSubtype, prevHandSubtype2) < Math.min(data[1], data[2]));
      case 1: //pair
        return prevHandSubtype < data[1];
      case 0: //highCard
        return prevHandSubtype < data[1];
    }
  }
}

function convertCardValue(value){
  switch (value){
    case '10':
      return 'a'
    case 'J':
      return 'b';
    case 'Q':
      return 'c';
    case 'K':
      return 'd';
    case 'A':
      return 'e';
    default:
      return value;
  }
}

function joinGame(socket, gameId){

  if (gameArray.includes(gameId)){
    socket.join(gameId)
    socket.gameId = gameId
    if (gameList[gameId].players.indexOf(socket.realId) == -1){
      gameList[gameId].addPlayer(socket.realId)
    }
    url = "/game/" + gameId

    // console.log(io.sockets.adapter.rooms[gameId])
    // console.log(io.sockets.adapter.rooms[socket.realId])


    io.to(socket.realId).emit("redirect", url)
  
    io.to(socket.gameId).emit("addToChat", playerList[socket.realId].name + " has joined the game");
    io.to(socket.gameId).emit("updatePlayerArray", gameList[gameId].players);
  }
  else{
    socket.emit("invalid", "Room does not exist")
  }
}

function createGame(socket, gameId){
  if (gameArray.includes(gameId)){
    socket.emit("invalid", "Room already exists")
    return -1
  }
  else{
    console.log("game created: " + gameId)
    gameArray.push(gameId)
    gameList[gameId] = new Game(gameId)
    joinGame(socket, gameId)
  }
}



io.on('connection', function(socket){

  socket.on('startSession', function(data){
    console.log("starting session")

    if (data.sessionId == null || !playerArray.includes(data.sessionId)){
      socket.realId = socket.id;
      socketList[socket.id] = socket;

      createPlayer(socket)
      console.log("new session")

    }
    else{
      socket.realId = data.sessionId
      playerList[socket.realId].active = true
      if (gameArray.includes(data.gameId)){
        socket.emit("resetState", {cards: playerList[socket.realId].cards, lives: playerList[socket.realId.lives], gameInProgress: gameList[data.gameId].gameInProgress})
      }
      console.log("old session")

    }
    socket.join(socket.realId)
    socket.emit("sessionAck", {sessionId: socket.realId})

  })

  socket.on("roomEntered", function(data){
    console.log("room entered")
    if (createGame(socket, data.gameId) == -1){
      joinGame(socket, data.gameId)
    }
  })

  socket.on("createGame", function(data){
    console.log("create game")
    createGame(socket, data.gameId)
  })

  socket.on("joinGame", function(data){
    console.log("join game")
    joinGame(socket, data.gameId)
  });

  socket.on("setName", function(data){
    console.log("setting name")
    playerList[socket.realId].setName(data.name)
    io.to(data.gameId).emit("updatePlayerArray", gameList[data.gameId].players);
  });

  socket.on('startGame', function(data){
    console.log("starting game")
    if (gameList[data.gameId].numPlayers > 1){
      gameList[data.gameId].gameInProgress = true;
      io.to(data.gameId).emit("displayPlayButtons");
      io.to(data.gameId).emit("clearChat");
      io.to(data.gameId).emit("updatePlayerArray", gameList[data.gameId].players);

  
      for (i in playerList){
        playerList[i].lives = MAX_LIVES;
      }
  
      setupRound(data.gameId);
    }
    else{
      io.to(data.gameId).emit("addToChat", "<b> not enough people <b>")
    }


  });

  socket.on('playTurn', function(data){
    if (socket.realId == playerArray[gameList[socket.gameId].playerTurn]){

      error = false;
      
      switch(data[0]){
        case "royalFlush":
          message = playerList[socket.realId].name + " played a ROYAL FLUSH";
          data[0] = 9;
          break;
        case "straightFlush":
          message = playerList[socket.realId].name + " played a " + data[2] + " high " + data[1] + " STRAIGHT FLUSH";
          data[0] = 8;
          data[2] = convertCardValue(data[2]);
          break;
        case "quad":
          message = playerList[socket.realId].name + " played FOUR " + data[1] + "'s";
          data[0] = 7;
          data[2] = convertCardValue(data[1]);
          break;
        case "fullHouse":
          message = playerList[socket.realId].name + " played " + data[1] + "'s FULL of " + data[2] + "'s";
          data[0] = 6;
          data[1] = convertCardValue(data[1]);
          data[2] = convertCardValue(data[2]);
          if (data[1] == data[2]){
            socket.emit("addToChat", "<b> can't pick fullhouse with same two values <b>");
            error = true;
          }
          break;
        case "flush":
          message = playerList[socket.realId].name + " played a " + data[1] + " FLUSH";
          data[0] = 5;
          break;
        case "straight":
          message = playerList[socket.realId].name + " played a " + data[1] + " high STRAIGHT";
          data[0] = 4;
          data[1] = convertCardValue(data[1]);
          break;
        case "triple":
          message = playerList[socket.realId].name + " played THREE " + data[1] + "'s";
          data[0] = 3;
          data[1] = convertCardValue(data[1]);
          break;
        case "twoPair":
          message = playerList[socket.realId].name + " played a PAIR of " + data[1] + "'s and a PAIR of " + data[2] + "'s";
          data[0] = 2;
          data[1] = convertCardValue(data[1]);
          data[2] = convertCardValue(data[2]);
          if (data[1] == data[2]){
            socket.emit("addToChat", " <b> can't pick two pair with same two values <b>");
            error = true;              
          }
          break;
        case "pair":
          message = playerList[socket.realId].name + " played a PAIR of " + data[1] + "'s";
          data[0] = 1;
          data[1] = convertCardValue(data[1]);
          break;
        case "highCard":        
          message = playerList[socket.realId].name + " played HIGH CARD " + data[1];
          data[0] = 0;
          data[1] = convertCardValue(data[1]);
          break;
        }

      if(!error && (gameList[socket.gameId].turnArray.length == 0 || checkHandIncreases(data))){
        gameList[socket.gameId].turnArray.push([playerList[socket.realId].name, data[0], data[1], data[2], message]);
  
        // io.to(data.gameId).emit("addToChat", '<i>' + message + '</i>');

        var newTurn = ++gameList[socket.gameId].playerTurn % gameList[socket.gameId].players.length
    
        gameList[socket.gameId].playerTurn = newTurn
    
        io.to(data.gameId).emit("updateGame", {newPlayerTurn: gameList[socket.gameId].players[newTurn], pastMove: gameList[socket.gameId].turnArray[gameList[socket.gameId].turnArray.length - 1][4]})
      }
      else{
        socket.emit("addToChat", "<b> please select a higher hand <b>")
      }
    }
    else{
      socket.emit("addToChat", "<b> not your turn <b>")
    }
  });

  socket.on('checkHand', function(data){

    if (gameList[data.gameId].playerTurn == null){
      socket.emit("addToChat", "<b> game has not started yet <b>")
    }
    else{
      //true if there is that hand
      handValidity = checkHand(data.gameId);
      //console.log(handValidity);
      doubtValidity = "CORRECTLY";
      if (handValidity){
        doubtValidity = "INCORRECTLY";
        playerList[socket.realId].lives--;
        //change turn to player who doubted
        gameList[data.gameId].playerTurn = gameList[data.gameId].players.indexOf(socket.realId)
      }
      else{
        playerList[playerArray[(playerArray.length + gameList[data.gameId].playerTurn - 1) % playerArray.length]].lives--
        //need to change turn to player who just played turn
        gameList[data.gameId].playerTurn = (gameList[data.gameId].playerTurn + gameList[data.gameId].numPlayers - 1) % gameList[data.gameId].numPlayers 
      }

      io.to(data.gameId).emit('addToChat', "<b> " + playerList[socket.realId].name + " " + doubtValidity + " doubted " + gameList[data.gameId].turnArray[gameList[data.gameId].turnArray.length - 1][0] + "'s hand </b>")
      for (i in playerList){
        io.to(data.gameId).emit('addToChat',playerList[i].name + " had: " + playerList[i].cards);
      }

      setupRound(data.gameId);
    }


  });

  socket.on('chat', function(data){
    // //console.log(playerList)
    io.to(data.gameId).emit('addToChat', playerList[socket.realId].name + ": " + data.text);
  })


  socket.on('disconnect', function(data){
    if (playerArray.includes(socket.realId)){
      console.log("attemped removal")
      playerList[socket.realId].active = false
      setTimeout(function(){
        if (playerList[socket.realId] == undefined || !playerList[socket.realId].active){
          io.to(socket.gameId).emit("addToChat", "<b> " + playerList[socket.realId].name + " has left the game <b>")
          gameList[socket.gameId].removePlayer(socket.realId)
          if (gameList[socket.gameId].numPlayers == 0){
            delete gameList[socket.gameId]
            const index = gameArray.indexOf(socket.gameId)
            if (index > -1){
              gameArray.splice(index)
            }
          }
          delete socketList[socket.realId]
          delete playerList[socket.realId]

          const index = playerArray.indexOf(socket.realId)
          if (index > -1){
            playerArray.splice(index)
          }
          io.to(socket.gameId).emit("updatePlayerArray", gameList[socket.gameId].players);
        }
      }, 5000)
    }
  });
});
