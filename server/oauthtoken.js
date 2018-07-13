/////////////////////////////////////////////////////////////////////
// Copyright (c) Autodesk, Inc. All rights reserved
// Written by Forge Partner Development
//
// Permission to use, copy, modify, and distribute this software in
// object code form for any purpose and without fee is hereby granted,
// provided that the above copyright notice appears in all copies and
// that both that copyright notice and the limited warranty and
// restricted rights notice below appear in all supporting
// documentation.
//
// AUTODESK PROVIDES THIS PROGRAM "AS IS" AND WITH ALL FAULTS.
// AUTODESK SPECIFICALLY DISCLAIMS ANY IMPLIED WARRANTY OF
// MERCHANTABILITY OR FITNESS FOR A PARTICULAR USE.  AUTODESK, INC.
// DOES NOT WARRANT THAT THE OPERATION OF THE PROGRAM WILL BE
// UNINTERRUPTED OR ERROR FREE.
/////////////////////////////////////////////////////////////////////

'use strict';

// web framework
var express = require('express');
var router = express.Router();
var request = require("request");
// Forge NPM
var forgeSDK = require('forge-apis');

// actually perform the token operation
var oauth = require('./oauth');

// Endpoint to return a 2-legged access token
router.get('/api/forge/oauth/token', function (req, res) {
    var client_id = req.query.clientid;
    var client_secret = req.query.clientsecret;
    var options = { method: 'POST',
    url: 'https://developer.api.autodesk.com/authentication/v1/authenticate',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    form: { 
            client_id: client_id,
            client_secret: client_secret,
            scope: 'bucket:create bucket:read data:read data:write data:create data:search',
            grant_type: 'client_credentials' }
          };

    request(options, function (error, response, body) {
        if (error) throw new Error(error);
        res.json(body);
    });

    // var response =  new forgeSDK.AuthClientTwoLegged(client_id, client_secret, scopes);
    // console.log(response.credentials)
    // res.json(response);
    
});

module.exports = router;