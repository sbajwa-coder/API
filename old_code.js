/* UNUSED CODE
This file is deticated to code that was made fully functional
but eventually not used within the end application, whilst
still requiring recognition for having been done. Any sections
in the report marked with "(UNUSED)" refers to the endpoints
listed and created in this document.
*/

/*Adding new Device*/
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
