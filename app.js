var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/', function(req, res){
  res.sendFile(__dirname + '/client/index.html');
});
app.use('/client', express.static(__dirname + '/client'));

serv.listen(2000);

var SOCKET_LIST = {};
var MAX_LIVES = 5;


var Player = function(id){
  
}

var io = require('socket.io')(serv, {});
io.sockets.on('connection', function(socket){

  socket.id = Math.random();

  SOCKET_LIST[socket.id] = socket;

  Player.onConnect(socket);


  socket.on('disconnect', function(){
    delete SOCKET_LIST[socket.id];
    Player.onDisconnect(socket);
  });
});