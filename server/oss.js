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
var fs = require('fs');
var guid = require('guid'); // random guid generator
var async = require ('async'); // async package for use of waterfall in upload resumable
var chalk = require('chalk'); // coloring terminal console logs https://github.com/chalk/chalk
var logs = console.log;

// Forge NPM
var forgeSDK = require('forge-apis');

// handle json requests
var bodyParser = require('body-parser');
var jsonParser = bodyParser.json();

// actually perform the token operation
var oauth = require('./oauth');

// Return list of buckets (id=#) or list of objects (id=bucketKey)
router.get('/api/forge/oss/buckets', function (req, res) {
    var id = req.query.id;
    var token = req.query.token; 
    var credentials = {}
    credentials.access_token = token;
        console.log('id')
        console.log(id)
    if (id === undefined) {// root
        // in this case, let's return all buckets
        var bucketsApi = new forgeSDK.BucketsApi();        
            bucketsApi.getBuckets({ limit: 100 }, {}, credentials).then(function (buckets) {
                var list = [];
                buckets.body.items.forEach(function (bucket) {
                    list.push({
                        id: bucket.bucketKey,
                        text: bucket.bucketKey,
                        type: 'bucket',
                        children: true
                    })
                })
                res.json(list);
            });
        
    }
    else {
        // as we have the id (bucketKey), let's return all objects
        var objectsApi = new forgeSDK.ObjectsApi();        
            objectsApi.getObjects(id, {}, {}, credentials).then(function (objects) {
                var list = [];
                objects.body.items.forEach(function (object) {
                    list.push({
                        id: object.objectId.toBase64(),
                        text: object.objectKey,
                        type: 'object',
                        children: false
                    })
                })
                res.json(list);
            });
        
    }
});

// Create a new bucket 
router.post('/api/forge/oss/buckets', jsonParser, function (req, res) {
        var token = req.body.token;
        var bucketsApi = new forgeSDK.BucketsApi();
        var postBuckets = new forgeSDK.PostBucketsPayload();
        postBuckets.bucketKey = req.body.bucketKey;
        postBuckets.policyKey = "transient"; 
        var credentials = {}
        credentials.access_token = token;
        bucketsApi.createBucket(postBuckets, {}, {}, credentials).then(function (buckets) {
            // console.log(res);
            res.json({data:buckets});
        }).catch(function (error) {
            if (error.statusCode && error.statusCode == 409)
                res.status(409).end();
            else {
                console.log('Error at OSS Create Bucket:');
                console.log(error);
                res.status(500).json(error);
            }
        });
});

// handle file upload
var multer = require('multer')
var upload = multer({ dest: './tmp' })

function deleteTmpFiles(){
    const fs = require('fs');
const path = require('path');

const directory = 'tmp';

fs.readdir(directory, (err, files) => {
  if (err) throw err;

  for (const file of files) {
    fs.unlink(path.join(directory, file), err => {
      if (err) throw err;
    });
  }
});
}
// Receive a file from the client and upload to the bucket
router.post('/api/forge/oss/objects', upload.single('fileToUpload'), function (req, res) {
    // oauth.getTokenInternal().then(function (credentials) {
        var bucketKey = req.body.bucketKey;
        var token = req.body.token; 
        var fileName = req.file.originalname;
        var credentials = {}
        credentials.access_token = token;
        var fs = require('fs');
        fs.readFile(req.file.path, function (err, data) {
            var objects = new forgeSDK.ObjectsApi();
            if (data.length < 5242879){
                objects.uploadObject(bucketKey, req.file.originalname, data.length, data, {}, {}, credentials)
                .then(function (object) {
                    setTimeout(function () {deleteTmpFiles()}, 0);
                    res.status(200).json({data:object});
                }).catch(function (error) {
                    console.log('Error at Upload Object:');
                    console.log(error);
                    setTimeout(function () {deleteTmpFiles()}, 0);
                    res.status(500).end();
                });
            }else{
                var filePath = req.file.path;
                var upload = new Promise(function (resolve, reject) {
                fs.readFile(filePath, function (err, data) {
                    if (err) {
                        reject(err);
                    }
                    else {
                        var chunkSize = 5 * 1024 * 1024
                        var nbChunks = Math.ceil(data.length / chunkSize)
                        var chunksMap = Array.from({
                            length: nbChunks
                        }, (e, i) => i)
        
                        // generates uniques session ID
                        var sessionId = guid.create();
                        var uploadChuckArray = [];
        
                        var range;
                        var readStream;
                        // prepare the upload tasks
                        chunksMap.map((chunkIdx) => {
                            var start = chunkIdx * chunkSize
                            var end = Math.min(data.length, (chunkIdx + 1) * chunkSize) - 1;
        
                            if (chunkIdx == (nbChunks - 1)) {
                                chunkSize = data.length - start; // Change the final content-length chunk since it will have a smaller number of bytes on last chunk
                            }
        
                            range = `bytes ${start}-${end}/${data.length}`
                            readStream = fs.createReadStream(filePath, {start, end})
        
                            chunksMap.forEach(function (chunk) {
                                uploadChuckArray.push(function (callback) {
                                    logs(chalk.bold.green("**** Uploading Chunks ***** with Range ", range));
                                    objects.uploadChunk(bucketKey, fileName, chunkSize, range, sessionId.value, readStream, {}, {}, credentials)
                                        .then(callback)
                                        .catch(callback)
                                })
                            });
        
                            async.waterfall(uploadChuckArray, function (err, result) {
                                if (err.statusCode == 200) {
                                 resolve(err)
                                }
                            })
        
        
                        });
                    }
                });
            });
            upload.then(function(uploadRes){
                setTimeout(function () {deleteTmpFiles()}, 0);
                res.json({data:uploadRes});
            }).catch(function(error){
                setTimeout(function () {deleteTmpFiles()}, 0);
                res.json({data:error});
            })

            }
        })
                   
});

String.prototype.toBase64 = function () {
    return new Buffer(this).toString('base64');
};

module.exports = router;