var express = require("express");
var mongoose = require('mongoose');
var assert = require("assert");
var favicon = require('serve-favicon');
var autoIncrement = require('mongoose-auto-increment');
var functions = require("./public/js/functions.js");

var url = 'mongodb://10.9.16.22:27017/chat';
var Schema = mongoose.Schema;
var connection = mongoose.createConnection(url);
autoIncrement.initialize(connection);

// Defining model for mongodb
var userSchema = new Schema({
  user_id: Number,
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  created_at: Date,
  updated_at: Date
});

// Add the date before any save
userSchema.pre('save', function(next) {
  // get the current date
  var currentDate = new Date();
  
  // change the updated_at field to current date
  this.updated_at = currentDate;

  // if created_at doesn't exist, add to that field
  if (!this.created_at)
    this.created_at = currentDate;

  next();
});

var messageSchema = new Schema({
  message_id: Number,
  user_id: String,
  room_id: String,
  to_user_id: String,
  message: String,
  created_at: Date
});

// Add the date before any save
messageSchema.pre('save', function(next) {
  // get the current date
  var currentDate = new Date();
  
  // change the updated_at field to current date
  this.updated_at = currentDate;

  // if created_at doesn't exist, add to that field
  if (!this.created_at)
    this.created_at = currentDate;

  next();
});

// Create User and Message schema
userSchema.plugin(autoIncrement.plugin, {
    model: 'User',
    field: 'user_id',
    startAt: 1,
    incrementBy: 1
});
messageSchema.plugin(autoIncrement.plugin, {
    model: 'Message',
    field: 'message_id',
    startAt: 1,
    incrementBy: 1
});

// Create User and Message schema
var User = connection.model('User', userSchema);
var Message = connection.model('Message', messageSchema);

var app = express();
var port = 3700;
var users = [];
var userSockets = [];
var rooms = [];
var mainRoom = 'express_chat';

// Setting template engine Jade
app.set('views', __dirname + '/tpl');
app.set('view engine', "jade");
app.engine('jade', require('jade').__express);
app.get("/", function(req, res){
    res.render("index");
});

// Require public folder resources
app.use(express.static(__dirname + '/public'));
app.use(favicon(__dirname + '/public/favicon.ico'));

// Pass express to socket.io
var io = require('socket.io').listen(app.listen(port));

// Initiate socket to handle all connection
io.sockets.on('connection', function (socket) {
	var _clientId = socket.id;

  socket.join(mainRoom);

  if (rooms.indexOf(mainRoom) == -1) {
    rooms.push(mainRoom);
  }

  // Trigger on send event
  socket.on('send', function (data) {
    var _clientUser = functions.findByKey(users, 'client_id', _clientId);
    var _clientUserId = _clientUser.user_id;
    
    var message = new Message({
      user_id: _clientUserId,
      user_name: data.username,
      room_id: data.room_id,
      message: data.message
    });
    message.save(function (err) {
      if (err != null) {
        console.log('There is an error saving data ' + err);
      }
    });

    io.sockets.in(data.room_id).emit('message', _clientUserId, _clientId, data);
  });

  socket.on('subscribe', function (_clientUserId, clientId, room_id) {
    if (room_id != mainRoom) {
      room_id = room_id + '_' + _clientUserId;

      console.log('Change room: ' + room_id + ' - Has room: ' + rooms.indexOf(room_id));
      
      if (rooms.indexOf(room_id) == -1) {
        console.log('Subscribe new room ' + room_id);

        // Create private chat between this socket and client
        socket.join(room_id);
        userSockets[clientId].join(room_id);

        rooms.push(room_id);
      }
      console.log('Rooms ' + rooms.toString());
    }

    // Create message content to hold between these two users
    io.sockets.in(room_id).emit('subscribe', _clientId, room_id);
  });

  // Listen for regist action
  socket.on('regist', function (data) {
    User.findOne({ username: data.username }, function (err, user) {
      if (user == null) {
        var newUser = new User({
          username: data.username,
          password: data.password
        });

        // Save user to database
        newUser.save(function (err) {
          console.log(err);

          if (err == null) {
            // Make this user online
            User.findOne({ username: data.username }, function (err, user) {
              console.log('User ' + user.username + ' is online');

              users.push({"client_id" : _clientId, "user_name" : data.username, "user_id": user.user_id});

              userSockets[_clientId] = socket;
              
              // Add new user to channel
              io.sockets.emit('show_user', user.user_id, _clientId, users);
            });
          }
        })
      } else {
        socket.emit('exception', {message: 'This user is already registered'});
      }
    });
  });
  
  // Login event
  socket.on('login', function (data) {
    User.findOne({ username: data.username }, function (err, user) {
      if (user == null) {
        socket.emit('exception', {message: 'This user is not exist. Please create your account !'});
      } else {
        User.findOne( { username: data.username, password: data.password }, function (err, user) {
          if (user == null) {
            socket.emit('exception', {message: 'Wrong password !'});
          } else {
            console.log('User ' + user.username + ' is online');
            // Add new user to store
            users.push({"client_id" : _clientId, "user_name" : data.username, "user_id": user.user_id});

            userSockets[_clientId] = socket;

            // Add new user to channel
            io.sockets.emit('show_user', user.user_id, _clientId, users);
          }
        });
      }
    });
  });

  // Listen for disconnect event
  socket.on('disconnect', function () {
    console.log('User ' + _clientId + ' is disconnecting ...');

    // Update current users online
    functions.removeObject(users, _clientId);

    // Remove user from all client channel
    io.sockets.emit('remove_user', _clientId, users);

    console.log('User ' + _clientId + ' disconnected');

    console.log(users.length + ' remaining.');
  });
});

console.log('Server started on port ' + port);