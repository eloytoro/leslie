require('babel-core/register')
require('jsdom-global/register')
const chai = require('chai')

chai.use(require('chai-as-promised'))
chai.use(require('sinon-chai'))
