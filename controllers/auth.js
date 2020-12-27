const crypto = require('crypto');

const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { validationResult } = require('express-validator');

const User = require('../models/user');

const transporter = nodemailer.createTransport({
    host: 'smtp.mailtrap.io',
    port: 2525,
    auth: {
        user: 'bb405eb1ad278f',
        pass: '132e32f6acab3b',
    },
});

exports.getLogin = (req, res, next) => {
    // console.log(req.session.user);
    // console.log(req.session.isLoggedIn);
    const message = req.flash('error');

    res.render('auth/login', {
        pageTitle: 'Login',
        path: '/login',
        errorMessage: message.length > 0 ? message[0] : null,
        oldInput: { email: '', password: '' },
        validationErrors: [],
    });
};

exports.getSignup = (req, res, next) => {
    const message = req.flash('error');

    res.render('auth/signup', {
        path: '/signup',
        pageTitle: 'Signup',
        errorMessage: message.length > 0 ? message[0] : null,
        oldInput: { email: '', password: '', confirmPassword: '' },
        validationErrors: [],
    });
};

exports.postLogin = (req, res, next) => {
    // res.setHeader('Set-Cookie', 'loggedIn=true; HttpOnly');
    const email = req.body.email;
    const password = req.body.password;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).render('auth/login', {
            pageTitle: 'Login',
            path: '/login',
            errorMessage: errors.array()[0].msg,
            oldInput: { email: email, password: password },
            validationErrors: errors.array(),
        });
    }

    User.findOne({ email: email })
        .then((user) => {
            if (!user) {
                return res.status(422).render('auth/login', {
                    pageTitle: 'Login',
                    path: '/login',
                    errorMessage: 'Invalid email or password.',
                    oldInput: { email: email, password: password },
                    validationErrors: [],
                });
            }

            return bcrypt
                .compare(password, user.password)
                .then((doMatch) => {
                    if (doMatch) {
                        //can add variable in req *this is can use on other routes
                        req.session.user = user;
                        req.session.isLoggedIn = true;
                        // save session into mangodb has delay, using save to validate if it saved then res.redirect
                        return req.session.save((err) => {
                            console.log(err);
                            res.redirect('/');
                        });
                    }

                    return res.status(422).render('auth/login', {
                        pageTitle: 'Login',
                        path: '/login',
                        errorMessage: 'Invalid email or password.',
                        oldInput: { email: email, password: password },
                        validationErrors: [],
                    });
                })
                .catch((err) => {
                    console.log(err);
                    res.redirect('/login');
                });
        })
        .catch((err) => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
};

exports.postSignup = (req, res, next) => {
    const email = req.body.email;
    const password = req.body.password;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // console.log(errors.array());

        return res.status(422).render('auth/signup', {
            path: '/signup',
            pageTitle: 'Signup',
            errorMessage: errors.array()[0].msg,
            oldInput: {
                email: email,
                password: password,
                confirmPassword: req.body.confirmPassword,
            },
            validationErrors: errors.array(),
        });
    }

    bcrypt
        .hash(password, 12)
        .then((hashedPassword) => {
            const user = new User({
                email: email,
                password: hashedPassword,
                cart: { items: [] },
            });

            return user.save();
        })
        .then((result) => {
            res.redirect('/login');

            return transporter.sendMail({
                from: 'andres@nodas.com',
                to: email,
                subject: 'Signup succeeded',
                text: '<h1>You successfully signed up!</h1>',
            });
        })
        .catch((err) => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
};

exports.postLogout = (req, res, next) => {
    req.session.destroy((err) => {
        res.redirect('/');
    });
};

exports.getReset = (req, res, next) => {
    const message = req.flash('error');

    res.render('auth/reset', {
        path: '/reset',
        pageTitle: 'Reset Password',
        errorMessage: message.length > 0 ? message[0] : null,
    });
};

exports.postReset = (req, res, next) => {
    crypto.randomBytes(32, (err, buffer) => {
        if (err) {
            console.log(err);
            return res.redirect('/reset');
        }

        const token = buffer.toString('hex');

        User.findOne({ email: req.body.email })
            .then((user) => {
                if (!user) {
                    req.flash('error', 'No account with that email found.');
                    return res.redirect('/reset');
                }

                user.resetToken = token;
                user.resetTokenExpired = Date.now() + 3600000;

                return user.save().then((result) => {
                    res.redirect('/');
                    transporter.sendMail({
                        from: 'andres@nodas.com',
                        to: req.body.email,
                        subject: 'Password reset',
                        text: `
                        <p>You requested a password reset</p>
                        <p>Click this <a href="http://localhost:3000/reset/${token}">link</a> to set a new password.</p>
                    `,
                    });
                });
            })
            .catch((err) => {
                const error = new Error(err);
                error.httpStatusCode = 500;
                return next(error);
            });
    });
};

exports.getNewPassword = (req, res, next) => {
    const token = req.params.token;

    User.findOne({ resetToken: token, resetTokenExpired: { $gt: Date.now() } })
        .then((user) => {
            // it change future
            if (!user) res.redirect('/');

            const message = req.flash('error');

            res.render('auth/new-password', {
                path: '/new-password',
                pageTitle: 'New Password',
                errorMessage: message.length > 0 ? message[0] : null,
                userId: user._id.toString(),
                passwordToken: token,
            });
        })
        .catch((err) => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
};

exports.postNewPassword = (req, res, next) => {
    const newPassword = req.body.password;
    const userId = req.body.userId;
    const passwordToken = req.body.passwordToken;
    let resetUser;

    User.findOne({ resetToken: passwordToken, resetTokenExpired: { $gt: Date.now() }, _id: userId })
        .then((user) => {
            resetUser = user;
            return bcrypt.hash(newPassword, 12);
        })
        .then((hashedPassword) => {
            resetUser.password = hashedPassword;
            resetUser.resetToken = undefined;
            resetUser.resetTokenExpired = undefined;

            return resetUser.save();
        })
        .then((result) => {
            res.redirect('/login');
        })
        .catch((err) => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
};
