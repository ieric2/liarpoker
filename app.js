var express = require('express');
var app = express();
var serv = require('http').Server(app);
var io = require('socket.io')(serv, {pingTimeout: 60000});

app.get('/', function(req, res){
  res.sendFile(__dirname + '/client/index.html');
});
app.use('/client', express.static(__dirname + '/client'));

serv.listen(process.env.PORT || 2000);
console.log("Server started.");

var MAX_LIVES = 5;

var socketList = {};
var turnList = [];
var playerList = {};
var playerArray = [];
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

function joinGame(socket){
  playerList[socket.id] = new Player(socket.id);
  playerList[socket.id].setName(socket.id);
  playerArray.push(socket.id);
  io.emit("addToChat", socket.id + " has joined the game");
  io.emit("updatePlayerList", playerList);
  console.log(playerList);
}


function drawCards(){
  for (i in playerList){
    playerList[i].cards = [];
    for (var n = 0; n < playerList[i].lives; n++){
      card = freeCards[Math.floor(Math.random() * freeCards.length)];
      playerList[i].cards.push(card);
      freeCards.splice(freeCards.indexOf(card), 1);
      usedCards.push(card);
    }
  }
}

function setupRound(){
  turnList = [];
  drawCards();

  playerTurn = Math.floor(Math.random() * playerArray.length);

  for(i in socketList){
    console.log(playerList[i].cards);
    socketList[i].emit('newRound', {cards: playerList[i].cards, newPlayerTurn: playerList[playerArray[playerTurn]].name, lives: playerList[i].lives});
  }
  console.log(playerArray);
  console.log("round Starting");  
}


function checkHand(socket, data){
  hand = turnList[turnList.length - 1];
  player = hand[0];
  handType = hand[1];
  handSubtype = hand[2];
  handSubtype2 = hand[3];

  console.log(usedCards);

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

    console.log(num);

    numCounts[num]++;
    suitCounts[suit]++;
  }
  console.log(numCounts);

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
  prevHand = turnList[turnList.length - 1];
  prevHandType = prevHand[1];
  prevHandSubtype = prevHand[2];
  prevHandSubtype2 = prevHand[3];

  handType = data[0];
  console.log(handType);
  console.log(prevHandType);
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

io.sockets.on('connection', function(socket){
  console.log("client connection");
  console.log(socket.id);

  socketList[socket.id] = socket;

  socket.on("joinGame", function(){
    joinGame(socket);
  });

  socket.on("setName", function(data){
    playerList[socket.id].setName(data);
    io.emit("updatePlayerList", playerList);
  });

  socket.on('startGame', function(){
    gameInProgress = true;
    console.log(playerList);
    io.emit("displayPlayButtons");

    for (i in socketList){
      if (playerList[i] == null){
        joinGame(socketList[i]);
      }
    }

    setupRound();

  });

  socket.on('playTurn', function(data){
    if ()
    console.log(playerTurn);

    console.log("turn for: " + playerList[playerArray[playerTurn]].name);
    if (socket.id == playerArray[playerTurn]){
      console.log("turn played");
      console.log("hand: "+ data[0] + data[1] + data[2]);
      error = false;
      
      switch(data[0]){
        case "royalFlush":
          message = playerList[socket.id].name + " played a ROYAL FLUSH";
          data[0] = 9;
          break;
        case "straightFlush":
          message = playerList[socket.id].name + " played a " + data[2] + " high " + data[1] + " STRAIGHT FLUSH";
          data[0] = 8;
          data[2] = convertCardValue(data[2]);
          break;
        case "quad":
          message = playerList[socket.id].name + " played FOUR " + data[1] + "'s";
          data[0] = 7;
          data[2] = convertCardValue(data[1]);
          break;
        case "fullHouse":
          message = playerList[socket.id].name + " played " + data[1] + "'s FULL of " + data[2] + "'s";
          data[0] = 6;
          data[1] = convertCardValue(data[1]);
          data[2] = convertCardValue(data[2]);
          if (data[1] == data[2]){
            socket.emit("addToChat", "<b> can't pick fullhouse with same two values <b>");
            error = true;
          }
          break;
        case "flush":
          message = playerList[socket.id].name + " played a " + data[1] + " FLUSH";
          data[0] = 5;
          break;
        case "straight":
          message = playerList[socket.id].name + " played a " + data[1] + " high STRAIGHT";
          data[0] = 4;
          data[1] = convertCardValue(data[1]);
          break;
        case "triple":
          message = playerList[socket.id].name + " played THREE " + data[1] + "'s";
          data[0] = 3;
          data[1] = convertCardValue(data[1]);
          break;
        case "twoPair":
          message = playerList[socket.id].name + " played a PAIR of " + data[1] + "'s and a PAIR of " + data[2] + "'s";
          data[0] = 2;
          data[1] = convertCardValue(data[1]);
          data[2] = convertCardValue(data[2]);
          if (data[1] == data[2]){
            socket.emit("addToChat", " <b> can't pick two pair with same two values <b>");
            error = true;              
          }
          break;
        case "pair":
          message = playerList[socket.id].name + " played a PAIR of " + data[1] + "'s";
          data[0] = 1;
          data[1] = convertCardValue(data[1]);
          break;
        case "highCard":        
          message = playerList[socket.id].name + " played HIGH CARD " + data[1];
          data[0] = 0;
          data[1] = convertCardValue(data[1]);
          break;
        }

      if(!error && (turnList.length == 0 || checkHandIncreases(data))){
        turnList.push([playerList[socket.id].name, data[0], data[1], data[2], message]);
  
        io.emit("addToChat", '<i>' + message + '</i>');
    
        playerTurn = ++playerTurn % playerArray.length;
    
        io.emit("updateGame", {newPlayerTurn: playerList[playerArray[playerTurn]].name, pastMove: turnList[turnList.length - 1][4]})
      }
      else{
        socket.emit("addToChat", "<b> please select a higher hand <b>")
      }
    }  
  });

  socket.on('checkHand', function(){
    //true if there is that hand
    handValidity = checkHand(socket);
    console.log(handValidity);
    doubtValidity = "CORRECTLY";
    if (handValidity){
      doubtValidity = "INCORRECTLY";
      playerList[socket.id].lives--;
    }
    else{
      playerList[playerArray[(playerArray.length + playerTurn - 1) % playerArray.length]].lives--
    }

    console.log(turnList)

    io.emit('addToChat', "<b> " + playerList[socket.id].name + " " + doubtValidity + " doubted " + turnList[turnList.length - 1][0] + "'s hand </b>")
    for (i in playerList){
      io.emit('addToChat',playerList[i].name + " had: " + playerList[i].cards);
    }


    setupRound();


  });

  socket.on('chat', function(data){
    io.emit('addToChat', playerList[socket.id].name + ": " + data);
  })

  socket.on('disconnect', function(reason){
    console.log(reason);
    delete socketList[socket.id];
    delete playerList[socket.id];
    io.emit("updatePlayerList", playerList);
    // playerArray.splice(playerArray.indexOf(socket.id), 1);
  });
});
