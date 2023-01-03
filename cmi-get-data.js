'use strict';

const async = require('async');
const http = require('http');

//const debug = require('debug')('cmi-config');

module.exports = function (RED) {

	const nodeName = 'NODE-RED-CONTRIB-TA-CMI (get-data): ';
	const debug = false;
	const debugDetailed = false;
	const liveData = true;

	function cmiGetData(config) {
		///
		/// dateTime
		///
		function dateTime(ts) {
			if (ts) { // Date and Time as a JS-Timestamp (in Millisekonds, as UTC)
				var date = new Date(ts * 1000)
				var hour = date.getUTCHours();
			} else { // no Parameter provided, so take system-time (not in UTC)
				var date = new Date()
				var hour = date.getHours();
			};
			var minute = date.getMinutes();
			var second = date.getSeconds();
			var day = date.getDate();
			var month = date.getMonth() + 1; // month as a number 0-11, so add 1
			var year = date.getFullYear();
			if (hour < 10) { hour = '0' + hour; }
			if (minute < 10) { minute = '0' + minute; }
			if (second < 10) { second = '0' + second; }
			if (day < 10) { day = '0' + day; }
			if (month < 10) { month = '0' + month; }
			return (year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second);
		} // function dateTime(ts);

		///
		/// Read data from CMI
		//
		function httpGet(hostname, username, password, canNode) {
			var sData = "";
			var res = {}; // result that is returned to the calling function (as the msg Object)
			res.data = {};

			if (liveData) {
				// start http-request
				if (debug) { console.log(nodeName + 'Starting httpGet to ' + hostname + ' started, using CANnode ' + canNode + ' and credentials ' + username + ' | ' + password + ' at ' + dateTime()) };
				const options = {
					auth: username + ':' + password,
					hostname: hostname,
					port: 80,
					path: '/INCLUDE/api.cgi?jsonnode='+canNode+'&jsonparam=La,Ld,I,O,Na,Nd,D',
					method: 'GET'
				}
				const httpResult = http.request(options, httpResult => {
					if (debug) { console.log(nodeName + 'HTTP request Status Code: ' + httpResult.statusCode) };
					if (httpResult.statusCode == 200) {
						// successfully connected to CMI
						if (debug) { console.log(nodeName + "Connection to CMI successfull") };
						// read http message...
						httpResult.on('data', d => {
							sData += d;
						})
						// ...until end
						httpResult.on('end', () => {
							// parse http message into object
							if (debug) { console.log(nodeName + "Start parsing HTTP Data") };
							try {
								res.data = JSON.parse(sData);
								res.httpStatusCode = httpResult.statusCode;
								res.httpStatusMessage = httpResult.statusMessage;
							} catch(err) {
								console.log(nodeName + "Error parsing result: " + err.message);
								res.data = {};
								res.httpStatusCode = '998';
								res.httpStatusMessage = "RESULT FROM HOST NOT PARSEABLE (" + err.message + ")";
							}
							res.payload = 'Call #' + callNumber + ' to ' + hostname + ' returning ' + res.httpStatusCode + ':' + res.httpStatusMessage + ') from config node';
							res.topic = "EMIT #" + callNumber;
							callNumber = callNumber + 1;
							node.send(res); // report the results from CMI to the node
							})
					}
					else {
						res.data = {};
						res.httpStatusCode = httpResult.statusCode;
						res.httpStatusMessage = httpResult.statusMessage;
						res.payload = 'Call #' + callNumber + ' to ' + hostname + ' returning ' + res.httpStatusCode + ':' + res.httpStatusMessage + ') from config node';
						res.topic = "EMIT #" + callNumber;
						callNumber = callNumber + 1;
						node.send(res); // report the results from CMI to the node
					}
				}).on('error', error => {
					res.data = {};
					res.httpStatusCode = '999';
					res.httpStatusMessage = "WRONG HOSTNAME, IP ADDRESS OR C.M.I. NOT REACHABLE";
					res.payload = 'Call #' + callNumber + ' to ' + hostname + ' returning ' + res.httpStatusCode + ':' + res.httpStatusMessage + ') from config node';
					res.topic = "EMIT #" + callNumber;
					callNumber = callNumber + 1;
					node.send(res); // report the results from CMI to the node
			})
				httpResult.end();

			} else { // if (liveData) for testing to not stress the CMI read values from global context store
				if (debug) { console.log(nodeName + "Start reading HTTP Data from global context store") };
				//res.data = node.context().global.get('cmiDataError' || 0);
				res.data = node.context().global.get('cmiDataSuccess' || 0);
				if (res.data == 0) {
					res.httpStatusCode = 300;
					res.httpStatusMessage = "NO LIVE DATA - Data in global context store not found"
				}
				else {
					res.httpStatusCode = 200;
					res.httpStatusMessage = 'NO LIVE DATA - Data coming from global context store';
				}
				res.payload = 'Call #' + callNumber + ' to ' + hostname + ' returning ' + res.data["Status code"] + ':' + res.data.Status + ' (' + dateTime(res.data.Header.Timestamp) + ') from config node'
				res.topic = "EMIT #" + callNumber;
				callNumber = callNumber + 1;
				node.send(res); // report the results from CMI to the node
			} // if (liveData)

		} // function httpGet

		//
		// Run this code on initialisation of the node (startup, deploay)
		//
		if (debug) { console.log(nodeName + 'Init start') }
		RED.nodes.createNode(this, config);

		var node = this;
		var callNumber = 0;
		node.Listeners = {};
		var canAddr = "1";

		if (typeof config.canNode !== "undefined") {
			canAddr = String(config.canNode);
		}

		if (debugDetailed) {
			node.log(nodeName + 'node description = ' + config.description);
			node.log(nodeName + "ip               = " + config.ip);
			node.log(nodeName + "canNode          = " + config.canNode);
			node.log(nodeName + "user             = " + node.credentials.user);
			// console.log(nodeName + "password         = " + node.credentials.password);
		} // if (debug)

		node.on('input', function(msg) {
			if (debug) { node.log(nodeName + "Get New Data from CMI"); }
			httpGet(config.ip, node.credentials.user, node.credentials.password, canAddr)
		});

	} // cmiGetData (config);

	//
	// register node and get username and password from config
	//
	RED.nodes.registerType("cmi get data", cmiGetData, {
		credentials: {
			user: { type: "text" },
			password: { type: "password" }
		}
	});

};


