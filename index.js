var http = require('http');
var os = require('os');
var socketIO = require('socket.io');
const express = require("express");
const { check, validationResult} = require("express-validator");
const bodyParser = require("body-parser");
const cookieParser = require('cookie-parser');
const bcrypt = require("bcryptjs");
const session = require('express-session');
const MongoClient = require('mongodb').MongoClient;
const url = "mongodb+srv://ajnabuild:ajnabuildauth@ajnabuild.ypts7.mongodb.net/";
const app = express();


//------Initializing Server------------------------    
var server = http.createServer(app);
server.listen(process.env.PORT || 8000);
var io = socketIO(server);

var myAwesomeDB;

// db connection
MongoClient.connect(url, {useUnifiedTopology: true,useNewUrlParser: true},function(err, database) {
    if (err) throw err;


     myAwesomeDB = database.db('ajnadb');


});



// Serve Static Assets
app.use(express.static('public'));


// for parsing req from body of html
app.use(bodyParser.urlencoded({ extended: true }));

// for cookies
app.use(cookieParser());

// session handling
app.use(session({
    key: 'user_sid',
    secret: 'somerandonstuffs',
    resave: false,
    saveUninitialized: false,
    cookie: {
        expires: 600000
    }
}));


// clearing cookie when user was left logged in and dint logged out
app.use((req, res, next) => {
    if (req.cookies.user_sid && !req.session.loggedinUser) {
        res.clearCookie('user_sid');        
    }
    next();
});

// redirecting to dashboard if already loggedin
const sessionChecker = (req, res, next) => {
    if (req.session.loggedinUser && req.cookies.user_sid) {
        res.redirect('/dashboard');
    } else {
        next();
    }    
};

// route for Home-Page
app.get('/', sessionChecker, (req, res) => {
    res.redirect('/login');
});

// route for user signup
app.route('/signup')
    .get(sessionChecker, (req, res) => {
        // res.sendFile(__dirname + '/public/signup.html');
        res.render("signup.ejs");
    }).post( (req, res) => {
        

        const username_s = req.body.username;
        // encrypting passowrd
        const salt_s = bcrypt.genSaltSync(10); 
        const password_s = bcrypt.hashSync(req.body.password, salt_s);
        
        try 
        {
            var myobj = { usernamedb: username_s, passworddb: password_s };
            myAwesomeDB.collection("ajnausers").insertOne(myobj, function(err, res) {
                if (err) throw err;
                console.log("Registered Successfully");                  
            });

        } catch (err) {
            console.log(err.message);
            res.status(500).send("Error in Saving");
        }
        res.redirect('/login');
    }
);



// route for user Login
app.route('/login')
    .get(sessionChecker, (req, res) => {
        var error_msg = "";
        // res.sendFile(__dirname + '/login.html');
        res.render('login.ejs',{error:error_msg});
    }).post((req, res) => {
          
        const username_l = req.body.username;
        const password_l = req.body.password;
          try {
            var isMatch;
            var myobj = { usernamedb: username_l};
            myAwesomeDB.collection("ajnausers").findOne(myobj, function(err, result) {
                if (err) throw err;
                        if(result !== null)
                    {
                    //   decrypting and comparing password
                      isMatch = bcrypt.compareSync(password_l, result.passworddb);                    
                    }
                    else{
                        isMatch = false;
                        var error_msg = "Incorrect username/password";
                        // return res.status(400).json({message: "Incorrect username/password"});
                        return res.render('login.ejs',{error:error_msg});
                    }

            
            if(isMatch === false) 
                {
                        isMatch = false;
                        var error_msg = "Incorrect username/password";
                        // return res.status(400).json({message: "Incorrect username/password"});
                        return res.render('login.ejs',{error:error_msg});
                }     
            
            // correct password and storing user in session
            req.session.loggedinUser = username_l;
            res.redirect('/dashboard');
            });
            
                  
          } catch (e) {
            console.error(e);
            res.status(500).json({
              message: "Server Error"
            });
          }
    }
);

// route for user's dashboard
app.get('/dashboard', (req, res) => {
    if (req.session.loggedinUser && req.cookies.user_sid) {
        // res.sendFile(__dirname + '/public/dashboard.html');
        res.render("webrtc.ejs");
    } else {
        res.redirect('/login');
    }
});



// route for user logout
app.get('/logout', (req, res) => {
    if (req.session.loggedinUser && req.cookies.user_sid) {
        res.clearCookie('user_sid');
        req.session.destroy();
        res.redirect('/');
    } else {
        res.redirect('/login');
    }
});




//------Socket.IO connections------------------
io.sockets.on('connection', function(socket) {
    // convenience function to log server messages on the client
    // arguments is an array like object which contains all the arguments of log(). 
    // to push all the arguments of log() in array, we have to use apply().
    function log() {
      var array = ['Message from server:'];
      array.push.apply(array, arguments);
      socket.emit('log', array);
    }
  
    socket.on('message', function(message, room) {
      log('Client said: ', message);
      // for a real app, would be room-only (not broadcast)
      socket.in(room).emit('message', message, room);
    });
  
    socket.on('create or join', function(room) {
      log('Received request to create or join room ' + room);
  
      var clientsInRoom = io.sockets.adapter.rooms[room];
      var numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
      log('Room ' + room + ' now has ' + numClients + ' client(s)');
  
      if (numClients === 0) {
        socket.join(room);
        log('Client ID ' + socket.id + ' created room ' + room);
        socket.emit('created', room, socket.id);
  
      } else if (numClients === 1) {
        log('Client ID ' + socket.id + ' joined room ' + room);
        io.sockets.in(room).emit('join', room);
        socket.join(room);
        socket.emit('joined', room, socket.id);
        io.sockets.in(room).emit('ready');
      } else { // max two clients
        socket.emit('full', room);
      }
    });
  
    socket.on('ipaddr', function() {
      var ifaces = os.networkInterfaces();
      for (var dev in ifaces) {
        ifaces[dev].forEach(function(details) {
          if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
            socket.emit('ipaddr', details.address);
          }
        });
      }
    });
  
    socket.on('bye', function(){
      console.log('received bye');
    });
  
  });
