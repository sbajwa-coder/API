const http = require('http');
const mysql = require('mysql');
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require("nodemailer");
// const WebSocket = require('ws');
const app = express()

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

// function setUpSocket() {
// 	wss = new WebSocket.Server({ port: 8080})
// 	wss.on('connection', function connection(ws) {
// 		console.log("Somebody connected")
// 	})
// }
// setUpSocket()

/*BEGIN API*/
/*Default Screen*/
app.get('/', (req,res) => {
	res.send('Something else!');
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
			queryStr = "INSERT INTO User (login, password) VALUES (?, ?);"
			connection.query(queryStr, [username, password], (err, rows, fields) => {
				if (err) {
					//Failed to register
					res.send(err);
				} else {
					res.send("Successfully registered with: " + username + "!\n")
				}
			})
		} else {
			//Username Exists already
			res.sendStatus(400)
		}
		res.end()
		return
	})

});

/*Login*/
app.post('/login', (req,res) => {
	const username = req.body.uname;
	const password = req.body.pass;
	if (username == null || password == null) {
		res.sendStatus(400)
		res.end()
	}

	const queryStr = "SELECT login FROM User WHERE login = ? AND password = ?;"
	connection.query(queryStr, [username, password], (err,rows,fields) => {
		if (err) {
			res.send(err)
		} else if (rows.length == 0) {
			//Your Username or Password is incorrect
			res.sendStatus(400)
		} else {
			res.send("Success!\n")
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
    
    var  queryStr = "SELECT login FROM User WHERE login = ? AND password = ?;"
    connection.query(queryStr, [username, oldPassword], (err,rows,fields) => {
        if (err) {
            res.send(err)
        } else if (rows.length == 0) {
            //Your Username or Password is incorrect
            res.sendStatus(400)
        } else {
            //Your Username and Password are correct => changing password
            queryStr = "UPDATE User SET password = ? WHERE login = ?;"
            connection.query(queryStr, [newPassword, username], (err, rows, fields) => {
                if (err) {
                    //Failed to register
                    res.send(err);
                } else {
                    res.send("Successfully changed password for: " + username + "!\n")
                }
            })
        }
        return
    })

});

/* Change Username */
app.post('/changeUsername', (req,res) => {
    const oldUsername = req.body.olduname
    const newUsername = req.body.newuname
    const password = req.body.pass
    if (password == null || oldUsername == null || newUsername == null) {
        res.sendStatus(400)
        res.end()
    }

    var queryStr = "SELECT login FROM User WHERE login = ? AND password = ?;"
    connection.query(queryStr, [oldUsername, password], (err,rows,fields) => {
        if (err) {
            res.send(err)
        } else if (rows.length == 0) {
            //Your Username or Password is incorrect
            res.sendStatus(400)
        } else {

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
                    		res.send("Successfully changed username for: " + newUsername + "!\n")
                		}
            		})
                } else {
                	//Username Exists already
					res.sendStatus(400)
                }
        	})

        }
        return
    })

});

var smtpTransport = nodemailer.createTransport({
    service: "Gmail",
    auth: {
        user: "securelocksignal@gmail.com",
        pass: "490rulez"
    }
});

app.post('/sendNewPassword', (req,res) => {
	const username = req.body.uname
    const password = req.body.pass
    if (username == null || password == null) {
        res.sendStatus(400)
        res.end()
    }
    var queryStr = "SELECT login FROM User WHERE login = ? AND password = ?;"
    connection.query(queryStr, [username, password], (err,rows,fields) => {
    	if (err) {
            res.send(err)
        } else if (rows.length == 0) {
            //Your Username or Password is incorrect
            res.sendStatus(400)
        } else {
        	var temporaryPassword = Math.random().toString(36).slice(-8);
        	var mailOptions={
	        	to : username,
	        	subject : "Please confirm your Email account",
	        	html : "Hello, your new password is" + temporaryPassword + "!" 
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
	var queryStr = "SELECT login FROM User WHERE login = ? AND password = ?;"

	//Authenticate User
	connection.query(queryStr, [username, password], (err,rows,fields) => {
		if (err) {
			//Failed to authenticate User
			res.send(err)
		} else if (rows.length == 0) {
			//Your Username or Password is incorrect
			res.sendStatus(400)
		} else {
			//Delete User
			queryStr = "DELETE FROM User WHERE login = ?;"
			connection.query(queryStr, [username], (err, rows, fields) => {
				if (err) {
					//Failed to delete User
					res.send(err)
				} else {
					res.send("Successfully deleted " + username + "! It was fun having you around!\n")
				}
				res.end()
				return
			})
		}
		return
	})

})

/*Adding new Device*/
app.post('/addDevice', (req, res) => {
	const username = req.body.uname;
	const password = req.body.pass;
	const deviceName = req.body.devname;
	if (username == null || password == null || username == "" || password == "") {
		res.sendStatus(400)
		res.end()
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

/*Removing Device
- Authenicate User
- Check if Device exists
- Check if User Owns Device
- Delete Device
*/
app.post('/removeDevice', (req, res) => {
	const username = req.body.uname;
	const password = req.body.pass;
	const did = req.body.did;
	if (username == null || password == null || did == null || username == "" || password == "" || did == "") {
		res.sendStatus(400)
		res.end()
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

/*Pair devices
- dids cannot be the same
- authenticate user
- Check if the own pairer and pairee device
- Add pair
*/
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

// Sending/Receiving Commands
var commands = new Map()

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

//localhost:3000
app.listen(port, () => {
	console.log("Is this working?");
});

//sls.alaca.ca/lock:TIMESTAMP
