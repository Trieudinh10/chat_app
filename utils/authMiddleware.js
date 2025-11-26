function requireLogin(req, res, next) {
  if (req.session.user) {
    next(); // đã login
  } else {
    res.redirect('/login.html'); // chưa login → login
  }
}

module.exports = { requireLogin };
