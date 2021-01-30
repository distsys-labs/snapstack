const chai = require('chai')
chai.use(require('chai-as-promised'))
global.should = chai.should()
global.expect = chai.expect
global.fs = require('fs')
global.path = require('path')
