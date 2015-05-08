'use strict';

var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var path = require('path');
var fs = require('fs');
var Hw2Core = require('../../../modules/js/src/kernel');


/*
* USAGE: rb <repoName> <pkgName>  [token|user:pass]
*/

Hw2Core(function () {
    var $ = this;
    $.Loader.load([
        "PATH_JS_LIB:nodejs/github/index.js",
        "PATH_JS_LIB:nodejs/git/index.js",
        "PATH_JS_LIB:filesystem/index.js"
    ], function () {
        var ghRepo = process.argv[2]; //github repo name
        var pkg = process.argv[3]; // pkg name
        var auth = process.argv[4] || null; // token or auth

        if (!ghRepo || !pkg)
            throw new Error("You must specify the github repository and package name\n\
                Use: rb <repoName> <pkgName> [token|user:pass]");

        var folderName = ghRepo; //$.Path.basename(pkg);
        var folderPath = path.join(process.cwd(), folderName);

        var opt = {};

        if (auth) {
            var prefix = "token=";
            auth.indexOf(prefix) === 0 ? (opt.token = auth.substring(prefix.length)) : (opt.auth = auth);
        }

        console.log("Creating github repository : " + ghRepo);

        // create repository on github
        var gitHub = $.NodeJs.GitHub(opt);
        gitHub.createRepo("orgs/hw2-core", ghRepo, function () {
            // wait github 
            setTimeout(function () {
                console.log("Cloning created repository on : " + folderName);

                var clone = spawn('git', ['clone', 'git@github.com:hw2-core/' + ghRepo + '.git', folderName], {env: process.env, cwd: process.cwd()});
                // create local master branch
                clone.on('close', function (data) {
                    createBranch("tests", function () {
                        createBranch("gh-pages", function () {
                            console.log("Creating json for pakage: " + pkg);
                            saveJson({
                                name: pkg,
                                devDependencies: {
                                    '%tests': 'hw2-core/' + ghRepo + '#tests',
                                    '%doc': 'hw2-core/' + ghRepo + '#gh-pages'
                                }
                            }, folderName);

                            //create basic gitignore
                            fs.writeFileSync(path.join(folderPath, '.gitignore'), 'doc/\ntests/\n');

                            pushOnline();
                        });
                    });
                });

                //clone.stderr.on('data', function (data) {
                //    throw new Error("Cannot clone repo because of : " + data);
                //});

                // push everything online
                var pushOnline = function () {
                    gitCommit(folderPath, function () {
                        gitCommit(path.join(folderPath, "doc"), function () {
                            gitCommit(path.join(folderPath, "tests"));
                        });
                    });
                };


                /*
                 * UTILS
                 */


                function createBranch (name, callback) {
                    console.log("Creating branch : " + name);
                    var src = path.join(folderPath, '.git');
                    var destBase = path.join(folderPath, name);
                    var dest = path.join(destBase, '.git');
                    fs.mkdir(path.join(folderPath, name), "0755");

                    console.log("Copying from " + src + " to " + dest);
                    exec("cp -r " + src + " " + dest, function (error, stdout, stderr) {
                        if (error !== null) {
                            console.log("exec error: " + error);
                        } else {
                            var checkout = spawn('git', ['checkout', '--orphan', name], {cwd: destBase});
                            checkout.on('close', function (data) {
                                var clean = spawn('git', ['rm', '-rf', '.'], {cwd: destBase});
                                clean.on('close', function (data) {
                                    console.log("Creating json for pakage: " + pkg + '/' + name);

                                    saveJson({
                                        name: pkg + '/' + name,
                                        dependencies: {
                                            '%parent': 'hw2-core/' + ghRepo,
                                        }
                                    }, destBase);

                                    callback && callback();
                                });
                            });
                        }
                    });
                }
                ;

                var saveJson = function (json, jPath) {
                    json.keep = [
                        ".git/config"
                    ];
                    json.license = "http://www.hyperweb2.com/terms";

                    var file;
                    var jsonStr = JSON.stringify(json, null, '  ') + '\n';

                    file = path.join(jPath, 'upt.json');
                    fs.writeFileSync(file, jsonStr);
                };

                var gitCommit = function (cwd, callback) {
                    console.log("Adding and committing for " + cwd);
                    var add = spawn('git', ['add', '.'], {cwd: cwd});
                    add.on('close', function (data) {
                        var commit = spawn('git', ['commit', '-m', 'Initial commit'], {cwd: cwd});
                        commit.on('close', function (data) {
                            //gitPush(cwd, callback);
                            callback && callback();
                        });
                    });
                };

                var gitPush = function (cwd, callback) {
                    var push = spawn('git', ['push', 'origin'], {cwd: cwd});
                    push.on('close', function (data) {
                        console.log(data);
                        callback && callback();
                    });
                };

            }, 2000);
        });
    });
});
