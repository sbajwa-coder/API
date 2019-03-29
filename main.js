const mysql = require('mysql');
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require("nodemailer");

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

//Read in command line input
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

//Error Codes
/*
500 - Internal Server Error
400 - Bad Request
403 - Forbidden
404 - Not Found
401 - Unnauthorized
418 - I'm a Teapot
*/

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
	res.send('HIIII333!');
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
			token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

			//Hash Password
			bcrypt.hash(password, saltRounds, function(err, hash) {
				if (err) {
					res.send(err)
				} else {
					// Store hash in your password DB.
					queryStr = "INSERT INTO User (login, password, token) VALUES (?, ?, ?);";
					connection.query(queryStr, [username, hash, token], (err, rows, fields) => {
						if (err) {
							//Failed to register
							res.send(err);
						} else {
							res.send(token);
							//res.send("Successfully registered with: " + username + "!\n")
						}
					})

				}
			})


		} else {
			//Username Exists already
			res.sendStatus(400)
		}
		return
	})

});

/*Login*/
app.post('/login', (req,res) => {
	const username = req.body.uname;
	var password = req.body.pass;
	if (username == null || password == null) {
		res.sendStatus(400)
		res.end()
	}

	var queryStr = "SELECT password FROM User WHERE login = ?;"
	connection.query(queryStr, [username], (err,rows,fields) => {
		if (err) {
			res.send(err)
		} else if (rows.length == 0) {
			//Your Username is incorrect
			res.sendStatus(400)
		} else {
			// Load hash from your password DB.
			bcrypt.compare(password, rows[0].password, function(err, is_same) {
				if (is_same) {
					//Password is correct
					password = rows[0].password
					queryStr = "SELECT token FROM User WHERE login = ? AND password = ?;"
					connection.query(queryStr, [username, password], (err,rows,fields) => {
						if (err) {
							res.send(err)
						} else if (rows[0].token == "" || rows[0].token == null) {
							//No token, must generate
							token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
							queryStr = "UPDATE User SET token = ?, token_bday = now() WHERE login = ? AND password = ?;"
							connection.query(queryStr, [token, username, password], (err,rows,fields) => {
								if (err) {
									res.send(err)
								} else {
									//Send Token back
									res.send(token)
								}
							})//End database query
						} else {
							//Token already exists, return token to user
							res.send(rows[0].token)
						}
					})//End databse query
				} else {
					//Password incorrect
					res.sendStatus(400)
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
            			queryStr = "UPDATE User SET login = ? WHERE login = ?;"
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
			        queryStr = "UPDATE User SET password = ? WHERE login = ?;"
            		connection.query(queryStr, [temporaryPassword, username], (err, rows, fields) => {
                		if (err) {
                    		//Failed to register
                    		res.send(err);
                		} else {
                    		res.send("Successfully changed password for: " + username + "!\n")
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
                html : "link: " + link
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
                            res.send("Successfully send confirm link for: " + username + "!\n")
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
                res.send(err)
            } else if (rows.length == 0) {
                res.status(400).send("Something went wrong, request a new confirmation link.")
            } else {
                queryStr = "UPDATE User SET confirmed = 1, confirmed_id = NULL WHERE login = ?;"
                    connection.query(queryStr, [req.query.name], (err, rows, fields) => {
                        if (err) {
                            //Failed to register
                            res.send(err);
                        } else {
                            res.send("Successfully confirmed account for: " + req.query.name + "!\n")
                        }
                    })
            }
            return
        })
    }
    else
    {
        res.end("<h1>Request is from unknown source</h1>");
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


/*Adding new Device*/
/* UNUSED CODE
app.post('/addDevice', (req, res) => {
	const username = req.body.uname;
	const password = req.body.pass;
	const deviceName = req.body.devname;
	if (username == null || password == null || username == "" || password == "") {
		res.sendStatus(400)
		res.end()
	}

	//Hash Password
	bcrypt.hash(password, saltRounds, function(err, hash) {
		if (err) {
			res.send(err)
		} else {
			password = hash
		}
	}

	var queryStr = "SELECT uid FROM User WHERE login = ? AND password = ?;"

	//Authenticate User
	connection.query(queryStr, [username, password], (err,rows,fields) => {
		if (err) {
			//Failed to authenticate User
			res.send(err)
		} else if (rows.length == 0) {
			//Your Username or Password is incorrect
			res.sendStatus(400)
		} else {
			//Add Device
			var uid = rows[0].uid;
			if (deviceName != null && deviceName != "") {
				queryStr = "INSERT INTO Device (uid, devname) VALUES (?, ?);"
				connection.query(queryStr, [uid, deviceName], (err, rows, fields) => {
					if (err) {
						//Failed to add device
						res.send(err)
					} else {
						res.send("Successfully added Device " + deviceName + "!\n")
					}
					res.end()
					return
				})

			} else {
				queryStr = "INSERT INTO Device (uid) VALUES (?);"
				connection.query(queryStr, [uid], (err, rows, fields) => {
					if (err) {
						//Failed to add device
						res.send(err)
					} else {
						res.send("Successfully added Device!\n")
					}
					res.end()
					return
				})
			}
		}
		return
	})
})
Unused Code */

/*Removing Device
- Authenicate User
- Check if Device exists
- Check if User Owns Device
- Delete Device
*/
/* UNUSED CODE
app.post('/removeDevice', (req, res) => {
	const username = req.body.uname;
	const password = req.body.pass;
	const did = req.body.did;
	if (username == null || password == null || did == null || username == "" || password == "" || did == "") {
		res.sendStatus(400)
		res.end()
	}

	//Hash Password
	bcrypt.hash(password, saltRounds, function(err, hash) {
		if (err) {
			res.send(err)
		} else {
			password = hash
		}
	}

	var queryStr = "SELECT uid FROM User WHERE login = ? AND password = ?;"

	//Authenticate User
	connection.query(queryStr, [username, password], (err,rows,fields) => {
		if (err) {
			//Failed to authenticate User
			res.send(err)
		} else if (rows.length == 0) {
			//Your Username or Password is incorrect
			res.sendStatus(400)
		} else {
			//Check if User Owns device
			const uid = rows[0].uid
			queryStr = "SELECT devname FROM Device WHERE did = ? AND uid = ?;"
			connection.query(queryStr, [did, uid], (err, rows, fields) => {
				if (err) {
					//Failed to check if user owns device
					res.send(err)
				} else if (rows.length == 0) {
					//device does not exist or user does not own the device
					res.sendStatus(400)
				} else {
					//User owns device
					const deviceName = rows[0].devname
					queryStr = "DELETE FROM Device WHERE did = ?;"
					connection.query(queryStr, [did], (err, rows, fields) => {
						if (err) {
							//Failed to delete Device
							res.send(err)
						} else {
							if (deviceName == "" || deviceName == null) {
								res.send("Successfully deleted Device!\n")
							} else {
								res.send("Successfully deleted " + deviceName + "!\n")
							} // end if
						} // end if
					})// end connection
				} // end if
			})// end connection
		} // end if
	})// end connection
})//
//
UNUSED CODE */

/*Pair devices
- dids cannot be the same
- authenticate user
- Check if the own pairer and pairee device
- Add pair
*/
/*UNUSED CODE
app.post('/pair', (req, res) => {
	const username = req.body.uname;
	const password = req.body.pass;
	const pairer_did = req.body.pairerdid;
	const pairee_did = req.body.paireedid;
	if (username == null || password == null || pairer_did == null || pairee_did == null || username == "" || password == "" || pairer_did == "" || pairee_did == "") {
		res.sendStatus(400)
		res.end()
	}

	if (pairer_did == pairee_did) {
		//dids cannot be the same
		res.sendStatus(400)
		res.end()
	}

	//Hash Password
	bcrypt.hash(password, saltRounds, function(err, hash) {
		if (err) {
			res.send(err)
		} else {
			password = hash
		}
	}

	// authenticate user
	var queryStr = "SELECT uid FROM User WHERE login = ? AND password = ?;"
	connection.query(queryStr, [username, password], (err,rows,fields) => {
		if (err) {
			res.send(err)
		} else if (rows.length == 0) {
			//Your Username or Password is incorrect
			res.sendStatus(400)
		} else {
			//Check if User Owns device
			const uid = rows[0].uid
			queryStr = "SELECT devname FROM Device WHERE did = ? AND uid = ?;"
			connection.query(queryStr, [pairer_did, uid], (err, rows, fields) => {
				if (err) {
					//Failed to check if user owns device
					res.send(err)
				} else if (rows.length == 0) {
					//pairer_device does not exist or user does not own the device
					res.sendStatus(400)
				} else {
					//User owns pairer_device, do they own pairee?
					const pairerDeviceName = rows[0].devname
					queryStr = "SELECT devname FROM Device WHERE did = ? AND uid = ?;"
					connection.query(queryStr, [pairee_did, uid], (err, rows, fields) => {
						if (err) {
							//Failed to check if user owns device
							res.send(err)
						} else if (rows.length == 0) {
							//pairee_device does not exist or user does not own the device
							res.sendStatus(400)
						} else {
							//User owns both devices
							const paireeDeviceName = rows[0].devname
							queryStr = "INSERT INTO paired_devices(did1, did2) VALUES(?,?);"
							connection.query(queryStr, [pairer_did, pairee_did], (err, rows, fields) => {
								if (err) {
									//Failed to add device
									res.send(err)
								} else {
									//Updated successfully
									if (pairerDeviceName != "" && paireeDeviceName != "" && pairerDeviceName != null && paireeDeviceName != null) {
										res.send("Paired " + pairerDeviceName + " to " + paireeDeviceName + " successfully!\n")
									} else {
										res.send("Paired Succesfully!\n")
									}
								} // end if
							})// end connection
						} // end if
					})// end connection
				} // end if
			})// end connection
		} // end if
	})
})

app.post('/unpair', (req, res) => {
	const username = req.body.uname;
	const password = req.body.pass;
	const pairer_did = req.body.pairerdid;
	const pairee_did = req.body.paireedid;
	if (username == null || password == null || pairer_did == null || pairee_did == null || username == "" || password == "" || pairer_did == "" || pairee_did == "") {
		res.sendStatus(400)
		res.end()
	}

	if (pairer_did == pairee_did) {
		//dids cannot be the same
		res.sendStatus(400)
		res.end()
	}

	//Hash Password
	bcrypt.hash(password, saltRounds, function(err, hash) {
		if (err) {
			res.send(err)
		} else {
			password = hash
		}
	}

	// authenticate user
	var queryStr = "SELECT uid FROM User WHERE login = ? AND password = ?;"
	connection.query(queryStr, [username, password], (err,rows,fields) => {
		if (err) {
			res.send(err)
		} else if (rows.length == 0) {
			//Your Username or Password is incorrect
			res.sendStatus(400)
		} else {
			//Check if User Owns device
			const uid = rows[0].uid
			queryStr = "SELECT devname FROM Device WHERE did = ? AND uid = ?;"
			connection.query(queryStr, [pairer_did, uid], (err, rows, fields) => {
				if (err) {
					//Failed to check if user owns device
					res.send(err)
				} else if (rows.length == 0) {
					//pairer_device does not exist or user does not own the device
					res.sendStatus(400)
				} else {
					//User owns pairer_device, do they own pairee?
					const pairerDeviceName = rows[0].devname
					queryStr = "SELECT devname FROM Device WHERE did = ? AND uid = ?;"
					connection.query(queryStr, [pairee_did, uid], (err, rows, fields) => {
						if (err) {
							//Failed to check if user owns device
							res.send(err)
						} else if (rows.length == 0) {
							//pairee_device does not exist or user does not own the device
							res.sendStatus(400)
						} else {
							//User owns both devices
							const paireeDeviceName = rows[0].devname
							queryStr = "DELETE FROM paired_devices WHERE did1 = ? AND did2 = ?;"
							connection.query(queryStr, [pairer_did, pairee_did], (err, rows, fields) => {
								if (err) {
									//Failed to unpair
									res.send(err)
								} else {
									//Unpaired Succesfully
									if (pairerDeviceName != "" && paireeDeviceName != "" && pairerDeviceName != null && paireeDeviceName != null) {
										res.send("Unpaired " + pairerDeviceName + " and " + paireeDeviceName + " successfully!\n")
									} else {
										res.send("Unpaired Succesfully!\n")
									}
								} // end if
							})// end connection
						} // end if
					})// end connection
				} // end if
			})// end connection
		} // end if
	})
})

UNUSED CODE */

// Sending/Receiving Commands
var commands = new Map()

/*
app.post('/saveCommands', (req, res) => {
	const login = req.body.uname;
	const command = req.body.command;
	if (login == null || command == null || login == "" || command == "") {
		res.sendStatus(400)
		res.end()
	}
	commands.set(login, command)
	if (commands.has(login) == false) {
		res.sendStatus(418)
		res.end()
	}
	res.end()
})

app.post('/checkCommands', (req, res) => {
	const login = req.body.uname;
	if (login == null || login == "") {
		res.sendStatus(400)
		res.end()
	}
	if (commands.has(login) == false) {
		// res.sendStatus(418)
		res.end()
	} else {
		res.send(commands.get(login))
		commands.delete(login)
	}
})
*/

app.post('/saveCommands', (req, res) => {
	console.log("save commands ...");
	const token = req.body.token;
	const command = req.body.command;
	if (command == null || token == null || command == "" || token == "") {
		res.sendStatus(400)
		res.end()
	}
	var queryStr = "SELECT token FROM User where token = ?;"
	connection.query(queryStr, [token], (err,rows,fields) => {
		if (err) {
			res.send(err)
		} else if (rows.length == 0 || rows[0].token == "" || rows[0].token == null) {
			//Never logged in or token is outdated
			res.send("User never logged in or token out of date. Please get new token.")
		} else {
			commands.set(token, command)
			if (commands.has(token) == false) {
				res.sendStatus(418)
			}
			res.end()
			return
		}
	})
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
	console.log("command check ....");
	const token = req.body.token;
	if (token == null || token == "") {
		res.sendStatus(400)
		res.end()
	}
	if (commands.has(token) == false) {

		//Start Long Polling
		wait(res, token)
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

	var queryStr = "SELECT token FROM User where token = ?;"
	connection.query(queryStr, [token], (err,rows,fields) => {
		if (err) {
			res.sendStatus(400)
		} else if (rows.length == 0 || rows[0].token == "" || rows[0].token == null) {
			//Never logged in or token is outdated
			res.send("User never logged in or token out of date. Please get new token.")
		} else {
			lock_bat.set(token, [locked, battery])
			if (lock_bat.has(token) == false) {
				res.sendStatus(418)
			}
			res.end()
			return
		}
	})


})

app.post('/checkStatus', (req, res) => {
	console.log("status check ...");
	const token = req.body.token;
	if (token == null || token == "") {
		res.sendStatus(400)
		res.end()
	}

	if (lock_bat.has(token) == false) {
		// res.sendStatus(418)
		console.log("no status entry ... ");
		res.end()
	} else {
		console.log("returning pc status ...");
		res.send(lock_bat.get(token))
	}
})
//localhost:3000
// app.listen(port, () => {
// 	console.log("Is this working?");
// });

//sls.alaca.ca/lock:TIMESTAMP
