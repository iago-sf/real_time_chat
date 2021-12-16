//? SOCKET
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
 
const io = require("socket.io")(server);

app.use(express.static('public'));

//? MONGO
const mongoose = require('mongoose');
const uri = "";
mongoose.connect(uri, {useNewUrlParser: true, useUnifiedTopology: true});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'Mongodb connection error:'));
db.once('open', function() { console.log("Connected to Mongodb"); });

const user_schema = new mongoose.Schema({
    name: String,
    password: String
});

const message_schema = new mongoose.Schema({
    user_: String,
    text: String,
    room_: String,
    date: { type: Date, default: Date.now}
});

const reg_user = mongoose.model('users', user_schema);
const comment = mongoose.model('comments', message_schema);

//? PROGRAMA
var users = {};

io.on('connection', function(socket) {
    console.log('A user has connected');

    socket.on('disconnect', function() {
        console.log('A user has disconnected');
        delete users["#"+socket.id];

        sentUsers();
    });

    //------------------------------------------//
    socket.on('register', function(re_user, pass){
        reg_user.findOne({name: re_user}, function(err, user){
            if(user){
                socket.emit('already_register', re_user);
                console.log("Usuario ya existente");

            } else {
                let new_user = new reg_user({name: re_user, password: pass});

                new_user.save(function (err, data) {
                    if (err) return console.error(err);
                    console.log("Usuario añadido");
                });

                socket.emit('succed_register', re_user);
            }
        });
    });

    //-----------------------------------------//
    socket.on('logged', function(log_user, pass) {
        reg_user.findOne({name: log_user, password: pass}, function(err, user){
            if(user){
                console.log("Usuario registrado con éxito");
                socket.name = log_user;
                users["#"+socket.id] = {name: log_user, room: socket.room};

                sentUsers();

                socket.emit('succed_login');
            } else {
                console.log("Usuario no registrado");
                socket.emit('failed_login');
            }
        });
    });

    //-----------------------------------------//
    socket.on('update', function(name, pass){
        reg_user.updateOne({name: socket.name}, {$set: {name: name, password: pass}}, function(){ 
            console.log('Usuario actualizado')

            socket.name = name;
            users["#"+socket.id] = {name: name, room: socket.room};

            sentUsers();
        });
    });

    //------------------------------------------//
    socket.on('drop_user', function(){
        reg_user.deleteOne({name: socket.name}, function(err, data){
            if(err) return handleError(err);
            console.log('Usuario eliminado');
            
            delete users["#"+socket.id];
            sentUsers();
        });
    });

    //------------------------------------------//
    socket.on('chatRoomS', function(room){
        socket.room = room;
        socket.join(room);
        users["#"+socket.id] = {name: socket.name, room: socket.room};

        comment.find({room_: room}, function(err, data){
            for(let i in data){
                socket.emit('chat_image', data[i].user_+": "+data[i].text);
            }
        });

        sentUsers();
    });
    socket.on('chat_left', function(){
        let old_room = socket.room;
        socket.leave(socket.room);

        users["#"+socket.id] = {name: socket.name, room: ''};
        socket.room = '';

        let userList = {};

        for(let i in users){
            if(users[i].room == old_room){
                userList[i] = users[i]; 
            }
        }

        io.to(old_room).emit('usersList',userList);
    });


    socket.on('chat message', function(msg) {
        console.log('message: ' + msg);

        save_comment(msg);

        io.to(socket.room).emit('chat message', socket.name+": "+msg);
    });

    socket.on('chat_image', function(msg) {
        console.log('message: ' + msg);

        save_comment(msg);

        io.to(socket.room).emit('chat_image', socket.name+": "+msg);
    });

    function sentUsers(){
        let userList = {};
    
        for(let i in users){
            if(users[i].room == socket.room){
                userList[i] = users[i]; 
            }
        }
    
        io.to(socket.room).emit('usersList',userList);
    }

    function save_comment(msg){
        let new_comment = new comment({user_: socket.name, text: msg, room_: socket.room});

        new_comment.save(function (err, data) {
            if (err) return console.error(err);
            console.log("Comentario añadido");
        });
    }
});

server.listen(3000, function() {
  console.log('listening on *:3000');
});



/**
* *    console.log(socket.handshake.headers);

* *    let users = io.sockets.sockets;
* *    console.log(socket);

* *    let troom = (socket.handshake.headers.referer).toString().split("rooms=")[1]; 
**/