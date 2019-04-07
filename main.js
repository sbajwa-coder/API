const mysql = require('mysql');
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require("nodemailer");
const path = require('path');

//For Password hashing
const bcrypt = require('bcrypt');
const saltRounds = 10;

// WebSocket requirements
const https = require('https');
const fs = require('fs');

const app = express();

const hostname = 'localhost';
const port = 3000;
// var socket;

//Mysql Setup
const pool = mysql.createPool({
	connectionLimit: 10,
	host: 'localhost',
	user: 'root',
	database: 'sls'
})
const connection = pool;

//For JWT token generation
const jwt = require('jsonwebtoken');
const config = require('./config')
function get_token(payload) {
	return jwt.sign(payload, config.secret, { expiresIn: '24h' });
}

function verify_token(token) {
	try {
  		var decoded = jwt.verify(token, config.secret);
		return true
	} catch(err) {
		return false
	}
}

//Read in command line input
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

//Logging in attempt cap stuff
const login_timeout_cap = 1;	//minutes

// SECURE SOCKETS IMPLEMENTATION
// -----------------------------
// gather credentials
var httpsServer = https.createServer({
		key: fs.readFileSync('/etc/letsencrypt/live/sls.alaca.ca/privkey.pem'),
		cert: fs.readFileSync('/etc/letsencrypt/live/sls.alaca.ca/cert.pem'),
		ca: fs.readFileSync('/etc/letsencrypt/live/sls.alaca.ca/chain.pem'),
		requestCert: false,
		rejectUnauthorized: false }, app);


//var io = require('socket.io')(httpsServer);
var io = require('socket.io')(httpsServer, {'transports': ['websocket', 'polling']});

io.on('connection', client => {
	console.log('TURKEY');
	client.emit('welcome', { message: 'Welcome!', id: client.id });
  client.on('event', data => { console.log('something idk'); });
  client.on('disconnect', () => { console.log('something idk2'); });
});

httpsServer.listen(port, () => {
	console.log("https listening...");
});
// END SECURE SOCKETS
// -----------------------------

/*BEGIN API*/
/*Default Screen*/
app.get('/', (req,res) => {
	res.send('Secure Lock Signal!');
});

/*Create New User*/
app.post('/register', (req,res) => {
	const username = req.body.uname
	const password = req.body.pass
	if (username == null || password == null) {
		res.sendStatus(400)
		res.end()
	}

	//Check if Username already exists
	var queryStr = "SELECT login FROM User WHERE login = ?;"
	connection.query(queryStr, [username], (err,rows,fields) => {
		if (err) {
			res.send(err)
		} else if (rows.length == 0) {
			//Register User

			//Hash Password
			bcrypt.hash(password, saltRounds, function(err, hash) {
				if (err) {
					res.send(err)
				} else {
					// Store hash in your password DB.
					queryStr = "INSERT INTO User (login, password) VALUES (?, ?);";
					connection.query(queryStr, [username, hash], (err, rows, fields) => {
						if (err) {
							//Failed to register
							res.send(err);
						} else {
							res.end();
						}
					})

				}
			})


		} else {
			//Username Exists already
			res.status(400).send("Username exists already!")
		}
		return
	})

});

/*Login*/
function loginToken(username, password, db_token, req, res) {
	if (db_token == "" || db_token == null) {
		//No token, must generate
		token = get_token(req.body);

		//Make login_attempt = 0 since correct login
		queryStr = "UPDATE User SET token = ?, token_bday = now(), login_attempts = 0, timed_out = false WHERE login = ? AND password = ?;"
		connection.query(queryStr, [token, username, password], (err,rows,fields) => {
			if (err) {
				res.send(err)
			} else {
				//Send Token back
				res.send(token)
			}
		})//End database query

	} else {
		//Token already exists
		token = db_token

		//Update login_attempts = 0 since correct
		queryStr = "UPDATE User SET login_attempts = 0, timed_out = false WHERE login = ? AND password = ?;"
		connection.query(queryStr, [username, password], (err,rows,fields) => {
			if (err) {
				res.send(err)
			} else {
				res.send(token)
			}
		})//End database query

	}
}

app.post('/login', (req,res) => {
	const username = req.body.uname;
	var password = req.body.pass;
	if (username == null || password == null) {
		res.sendStatus(400)
		res.end()
	}

	var queryStr = "SELECT password,confirmed FROM User WHERE login = ?;"
	connection.query(queryStr, [username], (err,rows,fields) => {
		if (err) {
			res.send(err)
		} else if (rows.length == 0) {
			//Your Username is incorrect
			res.sendStatus(400)
		} else if (rows[0].confirmed!=1){
			res.sendStatus(401);
		} else {
			// Compare database password to password provided
			bcrypt.compare(password, rows[0].password, function(err, is_same) {

				if (is_same) {
					//Password is correct
					password = rows[0].password
					queryStr = "SELECT token, timed_out FROM User WHERE login = ? AND password = ?;"
					connection.query(queryStr, [username, password], (err,rows,fields) => {
						if (err) {
							res.send(err)
						}

						timed_out = rows[0].timed_out
						db_token = rows[0].token
						if (timed_out) {
							//Check if timeout period over
							queryStr = "SELECT TIME_TO_SEC(TIMEDIFF(now(), (SELECT login_timeout FROM User WHERE login = ?)))/60 AS time_passed;"
							connection.query(queryStr, [username], (err,rows,fields) => {
								if (err) {
									res.send(err)
								} else {
									time_passed = rows[0].time_passed

									//If enough time has passed, and correct credentials, then
									if (time_passed > login_timeout_cap) {
										queryStr = "UPDATE User SET login_attempts = 0, timed_out = false, login_timeout = NULL WHERE login = ?;"
										connection.query(queryStr, [username, password], (err,rows,fields) => {
											if (err) {
												res.send(err)
											} else {
												loginToken(username, password, db_token, req, res)
											}
										})
									} else {
										res.send("This account has been timed out!");
									}
								}
							})
						} else {
							//Not timed out
							loginToken(username, password, db_token, req, res)
						}
					})//End databse query

				} else {
					//Password incorrect, increment login attempt counter
					queryStr = "UPDATE User SET login_attempts = login_attempts + 1 WHERE login = ?;"
					connection.query(queryStr, [username, password], (err,rows,fields) => {
						if (err) {
							res.send(err)
						} else {
							queryStr = "SELECT login_attempts, timed_out FROM User WHERE login = ?;"
							connection.query(queryStr, [username], (err,rows,fields) => {
								if (err) {
									res.send(err)
								} else if (rows[0].login_attempts >= 5) {
									if (rows[0].timed_out == false) {
										//Timeout account if not already timed out
										queryStr = "UPDATE User SET timed_out = true, login_timeout = now() WHERE login = ?;"
										connection.query(queryStr, [username], (err,rows,fields) => {
											if (err) {
												res.send(err)
											}
											res.send("This account has been timed out!");
										})
									} else {
										//ALready timed out
										res.send("This account has been timed out!");
									}
								} else {
									res.status(400).send("Username or Password incorrect!")
								}
							})
						}
					})//End database query

				}
			})//end bcrypt
		}
		return
	})
});

/* Change Password */
app.post('/changePassword', (req,res) => {
    const username = req.body.uname
    const oldPassword = req.body.oldPass
    const newPassword = req.body.newPass
    if (username == null || oldPassword == null || newPassword == null) {
        res.sendStatus(400)
        res.end()
    }

    var queryStr = "SELECT password FROM User WHERE login = ?;"
    connection.query(queryStr, [username, oldPassword], (err,rows,fields) => {
        if (err) {
            res.send(err)
        } else if (rows.length == 0) {
            res.status(400).send("Username or Password is incorrect")
        } else {
			  	//Comparing old password
				bcrypt.compare(oldPassword, rows[0].password, function(err, is_same) {
					if (is_same) {
						//Your Username and Password are correct => changing password
						bcrypt.hash(newPassword, saltRounds, function(err, hash) {
							if (err) {
								res.send(err)
							}

							queryStr = "UPDATE User SET password = ? WHERE login = ?;"
			            connection.query(queryStr, [hash, username], (err, rows, fields) => {
			                if (err) {
			                    //Failed to register
			                    res.send(err);
			                } else {
			                    res.send("Successfully changed password for: " + username + "!\n")
			                }
			            }); //end query
						}); //bcrypt hash end
					} else {
						//Password incorrect
						res.status(400).send("Username or Password is incorrect")
					}
				}); // bcrypt compare end
        }
        return
    });
});

/* Change Username */
app.post('/changeUsername', (req,res) => {
	const oldUsername = req.body.olduname
	const newUsername = req.body.newuname
	var password = req.body.pass
	if (password == null || oldUsername == null || newUsername == null) {
	   res.sendStatus(400)
	   res.end()
	}

 	var queryStr = "SELECT password FROM User WHERE login = ?;"
 	connection.query(queryStr, [oldUsername], (err,rows,fields) => {
     	if (err) {
         res.send(err)
     	} else if (rows.length == 0) {
         res.status(400).send("Username or password is incorrect")
     	} else {
			bcrypt.compare(password, rows[0].password, function(err, is_same) {
				password = rows[0].password
				if (err) {
					//Something went wrong
					res.send(err)
				} else if (is_same){
					queryStr = "SELECT login FROM User WHERE login = ?;"
					connection.query(queryStr, [newUsername], (err,rows,fields) => {
						if (err) {
                    //Failed to register
                    res.send(err);
                	} else if (rows.length == 0) {
                    //Your Username and Password are correct => changing username
            			queryStr = "UPDATE User SET login = ? , confirmed = 0 WHERE login = ?;"
            			connection.query(queryStr, [newUsername, oldUsername], (err, rows, fields) => {
                			if (err) {
                    			//Failed to register
                    			res.send(err);
               			} else {
                    			res.send("Successfully changed username to: " + newUsername + "!\n")
                			}
            			})
                	} else {
                		//Username Exists already
							res.sendStatus(400).send("Username exists already")
                	}
		        	})
				} else {
					//password incorrect
					res.status(400).send("Username or password is incorrect")
				}
			})
		}
	})
   // return
});

var auth = {
    type: 'oauth2',
    user: 'securelocksignal@gmail.com',
    clientId: '780509228639-h30o1qm3go1q5gmlj312r56rcu2uogeh.apps.googleusercontent.com',
    clientSecret: 'Sh0vEhl_DZQqxKzTw6fiGTeF',
    refreshToken: '1/UU8B30m6tLtRoRG8_VeHbNx28-cyJxpKUaW4cYlFJbzY933SKzKJMHFHBmCU-ZmR',
	accessToken: 'ya29.GlvRBhW40YPNdGhxfD6XFIKxpq-zD56xB1c4Lu7r7Tkqc_XU_LeM6smv7vdTsJIZTn0bM0edUOo6n8E8H9iosrv3V-MPFETBJi1lcZKBVPsKVH7muWM7hBVjdEWk'
};

var smtpTransport = nodemailer.createTransport({
	host: 'smtp.gmail.com',
	port: 465,
	secure: true,
    auth: auth
});

app.post('/sendNewPassword', (req,res) => {
	const username = req.body.uname
    if (username == null || username == "") {
        res.sendStatus(400)
        res.end()
    }
    var queryStr = "SELECT login FROM User WHERE login = ?;"
    connection.query(queryStr, [username], (err,rows,fields) => {
    	if (err) {
            res.send(err)
        } else if (rows.length == 0) {
			res.status(400).send("Username or Password is incorrect")
        } else {
        	var temporaryPassword = Math.random().toString(36).slice(-8);
        	var mailOptions={
	        	from : "securelocksignal@gmail.com",
	        	to : username,
	        	subject : "Spicy Lock Shawarma: temporary password",
	        	html : "Hello there! <br/>This email contains your new temporary password" +
	        	"for the Spicy Lock Shawarma app. <br/>Please copy it from this email in order " +
	        	"to change it to a new password in the app! <br/>" +
	        	"Your new password is: " + temporaryPassword + "<br/>" +
	        	"Thanks for using the app! <br/>" +
	        	"Sincerely, your Spicy team"
    		}
    		smtpTransport.sendMail(mailOptions, function(error, response){
                if(error){
                    res.end("error");
                } else {
                    bcrypt.hash(temporaryPassword, saltRounds, function(err, hash) {
                        if (err) {
                            res.send(err)
                        } else {
                            // Store hash in your password DB.
                            queryStr = "UPDATE User SET password = ? WHERE login = ?;";
                            connection.query(queryStr, [hash, username], (err, rows, fields) => {
                                if (err) {
                                    //Failed to register
                                    res.send(err);
                                } else {
                                    res.send("Successfully changed password for: " + username + "!\n");
                                }
                            })

                        }
                    })
                }
            });
        }
        return
    })
});

app.post('/sendConfirmEmail', (req,res) => {
    const username = req.body.uname
    if (username == null || username == "") {
        res.sendStatus(400)
        res.end()
    }
    var queryStr = "SELECT login FROM User WHERE login = ?;"
    connection.query(queryStr, [username], (err,rows,fields) => {
        if (err) {
            res.send(err)
        } else if (rows.length == 0) {
            res.status(400).send("Username is incorrect")
        } else {
            var confirmToken = Math.floor((Math.random() * 100) + 54);
            var link = "http://sls.alaca.ca/verify?name=" + username + "&id="+confirmToken;
            var mailOptions={
                from : "securelocksignal@gmail.com",
                to : username,
                subject : "Spicy Lock Shawarma: confirm your email",
                html : "Hello there! Please confirm your email for your SLS account by clikcing the link: "
						+ link + "<br/> Thanks for using the app! <br/>" + "Sincerely, your Spicy team"

            }
            smtpTransport.sendMail(mailOptions, function(error, response){
                if(error){
                    res.end("error");
                } else {
                    queryStr = "UPDATE User SET confirmed_id = ? WHERE login = ?;"
                    connection.query(queryStr, [confirmToken, username], (err, rows, fields) => {
                        if (err) {
                            //Failed to register
                            res.send(err);
                        } else {
                            res.send("Successfully sent confirm link for: " + username + "!\n")
                        }
                    })
                }
            });
        }
        return
    })
});

app.get('/verify',function(req,res){
    if(("http://"+req.get('host'))==("http://sls.alaca.ca")) {
        var queryStr = "SELECT login FROM User WHERE login = ? AND confirmed_id = ?;"
        connection.query(queryStr, [req.query.name, req.query.id], (err,rows,fields) => {
            if (err) {
                res.status(500).sendFile(path.join(__dirname + '/confirm_fail.html'));
            } else if (rows.length == 0) {
                res.status(400).sendFile(path.join(__dirname + '/confirm_fail.html'));
            } else {
                queryStr = "UPDATE User SET confirmed = 1, confirmed_id = NULL WHERE login = ?;"
                    connection.query(queryStr, [req.query.name], (err, rows, fields) => {
                        if (err) {
                            //Failed to register
                            res.status(500).sendFile(path.join(__dirname + '/confirm_fail.html'));
                        } else {
									res.sendFile(path.join(__dirname + '/confirm_succ.html'));
                        }
                    })
            }
            return
        })
    }
    else
    {
        res.status(500).sendFile(path.join(__dirname + '/confirm_fail.html'));
    }
    return
});

/*All Users*/
app.get('/users', (req,res) => {
	const queryStr = "SELECT login, uid FROM User;"
	connection.query(queryStr, (err, rows, fields) => {
		if (err) {
			//Failed to get all users
			res.send(err)
			res.end()
			return
		}
		res.send(rows)
	})
});

/*DATABASES*/
app.get('/databases', (req,res) => {
	const queryStr = "SHOW DATABASES;"
	connection.query(queryStr, (err, rows, fields) => {
		if (err) {
			//Failed to get all databases
			res.send(err)
			res.end()
			return
		}
		rows.push("temp message")
		res.send(rows)
	})
});

/*DB custom querying*/
app.post('/query', (req,res) => {
	let queryStr = req.body.query.split('+').join(' ');

	connection.query(queryStr, (err, rows, fields) => {
		if (err) {
			//Failed to get all users
			res.send(err)
			res.end()
			//return
		}
		res.send(rows)
	})
});

/*All Devices*/
app.get('/devices', (req,res) => {
	const queryStr = "SELECT * FROM Device;"
	connection.query(queryStr, (err, rows, fields) => {
		if (err) {
			//Failed to get all devices
			res.send(err)
			res.end()
			return
		}
		res.send(rows)
	})
});

/*Removing an Account*/
app.post('/removeAccount', (req, res) => {
	const username = req.body.uname;
	const password = req.body.pass;
	if (username == null || password == null) {
		res.sendStatus(400)
		res.end()
	}

	//Authenticate User
	var queryStr = "SELECT password FROM User WHERE login = ?;"
	connection.query(queryStr, [username], (err,rows,fields) => {
		if (err) {
			//Failed to authenticate User
			res.send(err)
		} else if (rows.length == 0) {
			//Your Username or Password is incorrect
			res.sendStatus(400)
		} else {
			bcrypt.compare(password, rows[0].password, function(err, is_same) {
				if (err) {
					res.send(err)
				} else if (is_same) {
					//Delete User
					queryStr = "DELETE FROM User WHERE login = ?;"
					connection.query(queryStr, [username], (err, rows, fields) => {
						if (err) {
							//Failed to delete User
							res.send(err)
						} else {
							res.send("Successfully deleted " + username + "! It was fun having you around! - Your Friends at Spicy Team\n")
						}
						res.end()
						return
					})
				} else {
					//Password incorrect
					res.sendStatus(400)
				}
			})
		}
		return
	}) //end query
})

// Sending/Receiving Commands
var commands = new Map()

app.post('/saveCommands', (req, res) => {
	console.log("save commands ... LOCK UNLOCK MOBILE");
	const token = req.body.token;
	const command = req.body.command;
	if (command == null || token == null || command == "" || token == "") {
		res.sendStatus(400)
		res.end()
	}

	//Verify Token
	if (!verify_token(token)) {
		res.status(400).send("Token Invalid")
	}

	commands.set(token, command)
	if (commands.has(token) == false) {
		res.sendStatus(418)
	}
	res.end()
	return
})

function sleep(ms) {
	return new Promise(resolve => {setTimeout(resolve, ms)});
}

async function wait(res, token) {
		//Sleep but async
		var timer = 10; //Timer
		var ms = 1000;	//Wait time
		while(timer != 0) {
			await sleep(ms);
			timer--;

			if (commands.has(token)) {
				res.send(commands.get(token))
				commands.delete(token)
				return
			}
		}
		return
}

app.post('/checkCommands', (req, res) => {
	console.log("command check .... DESKTOP");
	const token = req.body.token;
	if (token == null || token == "") {
		res.sendStatus(400)
		res.end()
	}

	//Verify Token
	if (!verify_token(token)) {
		res.status(400).send("Token Invalid")
	}

	if (commands.has(token) == false) {

		//Start Long Polling
		wait(res, token)
		res.end()
	} else {
		res.send(commands.get(token))
		commands.delete(token)
	}
})

//Receive Lock and Battery Status
var lock_bat = new Map()
app.post('/saveLockBat', (req, res) => {
	console.log("status save ...");
	const token = req.body.token;
	const locked = req.body.locked;
	const battery = req.body.battery;
	if (token == null || locked == null || battery == null || token == "" || locked == "" || battery == "") {
		res.sendStatus(402)
		res.end()
	}

	if (!verify_token(token)) {
		res.status(400).send("Token Invalid")
	}

	lock_bat.set(token, [locked, battery])
	if (lock_bat.has(token) == false) {
		res.status(400).send("Token Invalid")
	}
	res.end()
	return
})

app.post('/checkStatus', (req, res) => {
	console.log("status check ...");
	const token = req.body.token;
	if (token == null || token == "") {
		res.sendStatus(400)
		res.end()
	}

	if (!verify_token(token)) {
		res.status(400).send("Token Invalid")
	}

	if (lock_bat.has(token) == false) {
		console.log("no status entry ... ");
		res.end()
	} else {
		console.log("returning pc status ...");
		res.send(lock_bat.get(token))
	}
})
