const express = require("express");
const { check, validationResult} = require("express-validator");
const bodyParser = require("body-parser");
const cookieParser = require('cookie-parser');
const bcrypt = require("bcryptjs");
const session = require('express-session');
const MongoClient = require('mongodb').MongoClient;
const url = "mongodb+srv://ajnabuild:ajnabuildauth@ajnabuild.ypts7.mongodb.net/";

const app = express();

// PORT
const PORT = process.env.PORT || 4000;

var myAwesomeDB;

// db connection
MongoClient.connect(url, {useUnifiedTopology: true,useNewUrlParser: true},function(err, database) {
    if (err) throw err;


     myAwesomeDB = database.db('ajnadb');


    
    app.listen(PORT, (req, res) => {
        console.log(`Server Started at PORT ${PORT}`);
      });
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
        res.sendFile(__dirname + '/public/signup.html');
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
        res.sendFile(__dirname + '/public/login.html');
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
                        // return res.status(400).json({message: "Incorrect username/password"});
                        return res.redirect('/login');
                    }

            
            if(isMatch === false) 
                {
                    // return res.status(400).json({message: "Incorrect username/password"});
                    return res.redirect('/login');
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
        res.sendFile(__dirname + '/public/dashboard.html');
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


