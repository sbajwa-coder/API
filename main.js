const http = require('http');
const mysql = require('mysql');
const express = require('express');
const bodyParser = require('body-parser');
const app = express()

const hostname = 'localhost';
const port = 3000;

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

/*BEGIN API*/
/*Default Screen*/
app.get('/', (req,res) => {
	res.send("Hello there!");
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

//localhost:3000
app.listen(port, () => {
	console.log("Is this working?");
});
