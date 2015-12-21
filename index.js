var express = require("express");
var mongoose   = require("mongoose");
var mongoose = require('mongoose');
var assert = require("assert");
var favicon = require('serve-favicon');
var functions = require("./public/js/functions.js");

var url = 'mongodb://10.9.16.22:27017/chat';
mongoose.connect(url);
var Schema = mongoose.Schema;

// Defining model for mongodb
var userSchema = new Schema({
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
var User = mongoose.model('User', userSchema);
var Message = mongoose.model('Message', messageSchema);

module.exports = User;
module.exports = Message;

var app = express();
var port = 3700;
var users = [];

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

    // Trigger on send event
    socket.on('send', function (data) {
      var message = new Message({
        user_id: data.username,
        room_id: null,
        to_user_id: null,
        message: data.message
      });
      message.save(function (err) {
        console.log('There is an error saving data ' + err);
      });

      io.sockets.emit('message', _clientId, data);
    });

    // Listen for regist action
    socket.on('regist', function (data) {
      console.log('User ' + _clientId + ' is registering');

      User.find({ username: data.username }, function (err, user) {
        console.log(user.length);

        if (user.length == 0) {
          var newUser = new User({
            username: data.username,
            password: data.password
          });
          console.log('Inserting ' + data.username);

          // Save user to database
          newUser.save(function (err) {
            console.log(err);

            if (err == null) {
              // Make this user online
              console.log('User ' + _clientId + ' is online');

              users.push({"client_id" : _clientId, "user_name" : data.username});

              // Add new user to channel
              io.sockets.emit('show_user', _clientId, users);
            }
          })
        } else {
          socket.emit('exception', {message: 'This user is already registered'});
        }
      });
    });

    socket.on('login', function (data) {
      console.log('User ' + _clientId + ' is logging in');

      User.find({ username: data.username }, function (err, user) {
        console.log(user.length);

        if (user.length == 0) {
          socket.emit('exception', {message: 'This user is not exist. Please create your account !'});
        } else {
          User.find( { username: data.username, password: data.password }, function (err, user) {
            if (user.length == 0) {
              socket.emit('exception', {message: 'Wrong password !'});
            } else {
              // Add new user to store
              users.push({"client_id" : _clientId, "user_name" : data.username});
              socket.emit('show_user', _clientId, users);
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