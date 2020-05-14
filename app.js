var express = require('express');
var app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
server.listen(process.env.PORT || 8080);
server.setTimeout(1000)

app.get('/', function(req, res){
  console.log("sending index")
  res.sendFile(__dirname + '/client/index.html');
});

app.get('/game/:roomId', function(req, res){
  console.log("sending game")
  res.sendFile(__dirname + '/client/game.html');
})
app.use('/client', express.static(__dirname + '/client'));


//console.log("Server started.");

var MAX_LIVES = 5;

var socketList = {};
var playerList = {};

var turnArray = [];
var playerArray = [];
var gameArray = [];
var playerTurn = null;
var freeCards = [ "2H", "3H", "4H", "5H", "6H", "7H", "8H", "9H", "10H", "JH", "QH", "KH", "AH",
              "2D", "3D", "4D", "5D", "6D", "7D", "8D", "9D", "10D", "JD", "QD", "KD", "AD",
              "2S", "3S", "4S", "5S", "6S", "7S", "8S", "9S", "10S", "JS", "QS", "KS", "AS",
              "2C", "3C", "4C", "5C", "6C", "7C", "8C", "9C", "10C", "JC", "QC", "KC", "AC"];
var usedCards = [];
var gameStarted = [];

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

function createPlayer(socket){
  playerList[socket.realId] = new Player(socket.realId);
  playerArray.push(socket.realId);
}

function drawCards(){
  for (i in playerList){
    playerList[i].cards = [];
    for (var n = MAX_LIVES - playerList[i].lives + 1; n > 0; n--){
      card = freeCards[Math.floor(Math.random() * freeCards.length)];
      playerList[i].cards.push(card);
      freeCards.splice(freeCards.indexOf(card), 1);
      usedCards.push(card);
    }
    // //console.log(playerList[i].cards)
  }
}

function setupRound(){
  turnArray = [];
  drawCards();

  playerTurn = Math.floor(Math.random() * playerArray.length);
  //console.log(Object.keys(socketList))
  for(var i in playerList){
    console.log(i)
    io.to(socketList[i].realId).emit('newRound', {cards: playerList[i].cards, newPlayerTurn: playerList[playerArray[playerTurn]].name, lives: playerList[i].lives});
  }
}

//---------- GAME LOGIC -----------//

function checkHand(){
  hand = turnArray[turnArray.length - 1];
  console.log(turnArray)
  player = hand[0];
  handType = hand[1];
  handSubtype = hand[2];
  handSubtype2 = hand[3];

  //console.log(usedCards);

  numCounts = {"2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0, "a": 0, "b": 0, "c": 0, "d": 0, "e": 0};
  suitCounts = {"H": 0, "D": 0, "C": 0, "S": 0};

  for (var i = 0; i < usedCards.length; i++){
    if (usedCards[i].length == 3){
      num = convertCardValue(usedCards[i].substring(0, 2));
      suit = usedCards[i].charAt(2);
    }
    else{
      num = convertCardValue(usedCards[i].charAt(0));
      suit = usedCards[i].charAt(1);
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

function checkhandIncreases(data){
  prevHand = turnArray[turnArray.length - 1];
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
    console.log("joining room: " + gameId)
    url = "/game/" + gameId
    io.to(socket.realId).emit("redirect", url)
  
    io.emit("addToChat", playerList[socket.realId].name + " has joined the game");
    io.emit("updatePlayerList", playerList);
  }
  else{
    io.emit("error", "Room does not exist")
  }
}



io.on('connection', function(socket){
  socket.on('startSession', function(data){

    if (data.sessionId == null || !playerArray.includes(data.sessionId)){
      socket.realId = socket.id;
      socketList[socket.id] = socket;

      createPlayer(socket)
    }
    else{
      socket.realId = data.sessionId
      playerList[socket.realId].active = true
    }
    socket.join(socket.realId)
    socket.emit("sessionAck", {sessionId: socket.realId})
    io.emit("updatePlayerList", playerList);

  })

  socket.on("roomEntered", function(gameId){
    if(!gameArray.includes(gameId)){
      console.log("Game created: " + gameId)
      gameArray.push(gameId)
    }
  })

  socket.on("createGame", function(gameId){
    if (gameArray.includes(gameId)){
      io.emit("error", "Room already exists")
    }
    else{
      console.log("creating new room: " + gameId)
      gameArray.push(gameId)
      console.log(gameArray)
      joinGame(socket, gameId)
    }
  })

  socket.on("joinGame", function(gameId){
    joinGame(socket, gameId)
  });

  socket.on("setName", function(data){
    playerList[socket.realId].setName(data)
    io.emit("updatePlayerList", playerList);
  });

  socket.on('startGame', function(){
    if (playerArray.length > 1){
      gameInProgress = true;
      // //console.log(playerList);
      io.emit("displayPlayButtons");
      io.emit("clearChat");
      io.emit("updatePlayerList", playerList);

  
      for (i in playerList){
        playerList[i].lives = MAX_LIVES;
      }
  
      setupRound();
    }
    else{
      io.emit("addToChat", "<b> not enough people <b>")
    }


  });

  socket.on('playTurn', function(data){
    //console.log("turn playing")
    //console.log(playerTurn);

    //console.log("turn for: " + playerList[playerArray[playerTurn]].name);
    if (socket.realId == playerArray[playerTurn]){
      //console.log("turn played");
      //console.log("hand: "+ data[0] + data[1] + data[2]);
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

      if(!error && (turnArray.length == 0 || checkHandIncreases(data))){
        turnArray.push([playerList[socket.realId].name, data[0], data[1], data[2], message]);
  
        io.emit("addToChat", '<i>' + message + '</i>');
    
        playerTurn = ++playerTurn % playerArray.length;
    
        io.emit("updateGame", {newPlayerTurn: playerList[playerArray[playerTurn]].name, pastMove: turnArray[turnArray.length - 1][4]})
      }
      else{
        socket.emit("addToChat", "<b> please select a higher hand <b>")
      }
    }  
  });

  socket.on('checkHand', function(){
    //true if there is that hand
    handValidity = checkHand(socket);
    //console.log(handValidity);
    doubtValidity = "CORRECTLY";
    if (handValidity){
      doubtValidity = "INCORRECTLY";
      playerList[socket.realId].lives--;
    }
    else{
      playerList[playerArray[(playerArray.length + playerTurn - 1) % playerArray.length]].lives--
    }

    //console.log(turnArray)

    io.emit('addToChat', "<b> " + playerList[socket.realId].name + " " + doubtValidity + " doubted " + turnArray[turnArray.length - 1][0] + "'s hand </b>")
    for (i in playerList){
      io.emit('addToChat',playerList[i].name + " had: " + playerList[i].cards);
    }


    setupRound();


  });

  socket.on('chat', function(data){
    // //console.log(playerList)
    io.emit('addToChat', playerList[socket.realId].name + ": " + data);
  })


  socket.on('disconnect', function(reason){
    //console.log(reason);
    if (playerArray.includes(socket.realId)){
      console.log("attemped removal")
      playerList[socket.realId].active = false
      setTimeout(function(){
        if (!playerList[socket.realId].active){
          io.emit("addToChat", "<b> " + playerList[socket.realId].name + " has left the game <b>")

          delete socketList[socket.realId]
          delete playerList[socket.realId]
          playerArray.splice(playerArray.indexOf(socket.realId))
          io.emit("updatePlayerList", playerList);

          console.log("removed")
        }
      }, 5000)
    }
  });
});
