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

/*BEGIN API*/
/*Default Screen*/
app.get('/', (req,res) => {
	res.send("Hello there!");
});

/*Create New User*/
app.post('/register', (req,res) => {
	const username = req.body.uname
	const password = req.body.pass

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
					res.send("Failed to create new User!\n" + err);
				} else {
					res.send("Successfully registered with: " + username + "!")
				}
				return
			})
		} else {
			res.send(username + " exists already!")
		}
		res.end()
		return
	})

});

/*Login*/
app.post('/login', (req,res) => {
	const username = req.body.uname;
	const password = req.body.pass;
	const queryStr = "SELECT login FROM User WHERE login = ? AND password = ?;"

	connection.query(queryStr, [username, password], (err,rows,fields) => {
		if (err) {
			res.send(err)
		} else if (rows.length == 0) {
			res.send("Your Username or Password is incorrect!")
		} else {
			res.send("Success!")
		}
		return
	})
});

/*All Users*/
app.get('/users', (req,res) => {
	const userId = req.params.id
	const queryStr = "SELECT login FROM User;"
	connection.query(queryStr, (err, rows, fields) => {
		if (err) {
			res.send(err)
			res.end()
			return
		}
		res.send(rows)
	})
});

//localhost:3000
app.listen(port, () => {
	console.log("Is this working?");
});
