// Comprehensive Mocha/Chai test suite covering all endpoints and auth scenarios
const chai = require('chai');
const chaiHttp = require('chai-http');
const jwt = require('jsonwebtoken');

// Load environment before importing app
require('dotenv').config();

const app = require('../server');
const db = require('../db');

const expect = chai.expect;
chai.use(chaiHttp);

describe('REST API Server Tests', function() {
  let agent;

  before(function() {
    agent = chai.request.agent(app);
  });

  after(function() {
    agent.close();
  });

  describe('POST /signup', function() {
    it('should create user with valid input', function(done) {
      agent
        .post('/signup')
        .send({ username: 'testuser1', password: 'testPass123!' })
        .end((err, res) => {
          expect(res).to.have.status(201);
          expect(res.body).to.have.property('success', true);
          expect(res.body).to.have.property('message', 'User created');
          expect(res.body).to.not.have.property('password');
          expect(res.body).to.not.have.property('passwordHash');
          done();
        });
    });

    it('should reject duplicate username', function(done) {
      agent
        .post('/signup')
        .send({ username: 'testuser1', password: 'anotherPass123!' })
        .end((err, res) => {
          expect(res).to.have.status(409);
          expect(res.body).to.have.property('success', false);
          done();
        });
    });

    it('should reject missing fields', function(done) {
      agent
        .post('/signup')
        .send({ username: 'testuser2' })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body).to.have.property('success', false);
          done();
        });
    });

    it('should reject invalid username (regex violation)', function(done) {
      agent
        .post('/signup')
        .send({ username: 'test$user', password: 'testPass123!' })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body).to.have.property('success', false);
          done();
        });
    });

    it('should reject short password', function(done) {
      agent
        .post('/signup')
        .send({ username: 'testuser3', password: 'short' })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body).to.have.property('success', false);
          done();
        });
    });

    it('should store password as bcrypt hash', function(done) {
      const user = db.findOne('username', 'testuser1');
      expect(user).to.exist;
      expect(user.passwordHash).to.exist;
      expect(user.passwordHash).to.match(/^\$2[aby]\$/); // bcrypt hash format
      expect(user.passwordHash).to.not.equal('testPass123!');
      done();
    });
  });

  describe('POST /signin', function() {
    it('should return JWT token with valid credentials', function(done) {
      agent
        .post('/signin')
        .send({ username: 'testuser1', password: 'testPass123!' })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property('success', true);
          expect(res.body).to.have.property('token');
          expect(res.body.token).to.be.a('string');
          done();
        });
    });

    it('should reject wrong password', function(done) {
      agent
        .post('/signin')
        .send({ username: 'testuser1', password: 'wrongPassword!' })
        .end((err, res) => {
          expect(res).to.have.status(401);
          expect(res.body).to.have.property('success', false);
          expect(res.body).to.have.property('message', 'Invalid credentials');
          done();
        });
    });

    it('should reject non-existent user', function(done) {
      agent
        .post('/signin')
        .send({ username: 'nonexistent', password: 'somePassword!' })
        .end((err, res) => {
          expect(res).to.have.status(401);
          expect(res.body).to.have.property('success', false);
          expect(res.body).to.have.property('message', 'Invalid credentials');
          done();
        });
    });

    it('should return JWT containing only id and username', function(done) {
      agent
        .post('/signin')
        .send({ username: 'testuser1', password: 'testPass123!' })
        .end((err, res) => {
          const decoded = jwt.decode(res.body.token);
          expect(decoded).to.have.property('id');
          expect(decoded).to.have.property('username', 'testuser1');
          expect(decoded).to.not.have.property('passwordHash');
          expect(decoded).to.not.have.property('password');
          done();
        });
    });

    it('should return JWT that expires in 1 hour or less', function(done) {
      agent
        .post('/signin')
        .send({ username: 'testuser1', password: 'testPass123!' })
        .end((err, res) => {
          const decoded = jwt.decode(res.body.token);
          const expiryTime = decoded.exp - decoded.iat;
          expect(expiryTime).to.be.at.most(3600); // 1 hour = 3600 seconds
          done();
        });
    });
  });

  describe('GET /movies', function() {
    it('should return 200 with correct structure', function(done) {
      agent
        .get('/movies')
        .query({ genre: 'action' })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property('status', 200);
          expect(res.body).to.have.property('message', 'GET movies');
          expect(res.body).to.have.property('headers');
          expect(res.body).to.have.property('query');
          expect(res.body.query).to.have.property('genre', 'action');
          expect(res.body).to.have.property('env');
          expect(res.body.env).to.equal(process.env.UNIQUE_KEY);
          done();
        });
    });
  });

  describe('POST /movies', function() {
    it('should return 200 with movie saved message', function(done) {
      agent
        .post('/movies')
        .send({ title: 'Test Movie' })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property('status', 200);
          expect(res.body).to.have.property('message', 'movie saved');
          expect(res.body).to.have.property('headers');
          expect(res.body).to.have.property('query');
          expect(res.body).to.have.property('env');
          done();
        });
    });
  });

  describe('PUT /movies', function() {
    let validToken;

    before(function(done) {
      agent
        .post('/signin')
        .send({ username: 'testuser1', password: 'testPass123!' })
        .end((err, res) => {
          validToken = res.body.token;
          done();
        });
    });

    it('should return 200 with valid JWT', function(done) {
      agent
        .put('/movies')
        .set('Authorization', `Bearer ${validToken}`)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property('status', 200);
          expect(res.body).to.have.property('message', 'movie updated');
          expect(res.body).to.have.property('headers');
          expect(res.body).to.have.property('query');
          expect(res.body).to.have.property('env');
          done();
        });
    });

    it('should return 401 without token', function(done) {
      agent
        .put('/movies')
        .end((err, res) => {
          expect(res).to.have.status(401);
          done();
        });
    });

    it('should return 401 with invalid token', function(done) {
      agent
        .put('/movies')
        .set('Authorization', 'Bearer invalidtoken')
        .end((err, res) => {
          expect(res).to.have.status(401);
          done();
        });
    });
  });

  describe('DELETE /movies', function() {
    it('should return 200 with valid Basic auth', function(done) {
      const credentials = Buffer.from(`${process.env.DEFAULT_USER}:${process.env.DEFAULT_PASSWORD}`).toString('base64');
      agent
        .delete('/movies')
        .set('Authorization', `Basic ${credentials}`)
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property('status', 200);
          expect(res.body).to.have.property('message', 'movie deleted');
          expect(res.body).to.have.property('headers');
          expect(res.body).to.have.property('query');
          expect(res.body).to.have.property('env');
          done();
        });
    });

    it('should return 401 without credentials', function(done) {
      agent
        .delete('/movies')
        .end((err, res) => {
          expect(res).to.have.status(401);
          done();
        });
    });

    it('should return 401 with wrong password', function(done) {
      const credentials = Buffer.from(`${process.env.DEFAULT_USER}:wrongPassword`).toString('base64');
      agent
        .delete('/movies')
        .set('Authorization', `Basic ${credentials}`)
        .end((err, res) => {
          expect(res).to.have.status(401);
          done();
        });
    });
  });

  describe('Unsupported methods', function() {
    it('should return 405 for PATCH /movies', function(done) {
      agent
        .patch('/movies')
        .end((err, res) => {
          expect(res).to.have.status(405);
          expect(res.body).to.have.property('message', 'HTTP method not supported');
          expect(res).to.have.header('allow', 'GET, POST, PUT, DELETE');
          done();
        });
    });
  });

  describe('Chained integration test', function() {
    it('should signin, extract token, and PUT /movies', function(done) {
      agent
        .post('/signin')
        .send({ username: 'testuser1', password: 'testPass123!' })
        .end((err, res) => {
          expect(res).to.have.status(200);
          const token = res.body.token;

          agent
            .put('/movies')
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Updated Movie' })
            .end((err, res) => {
              expect(res).to.have.status(200);
              expect(res.body).to.have.property('message', 'movie updated');
              done();
            });
        });
    });
  });
});
