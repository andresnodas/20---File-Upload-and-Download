const monggose = require('mongoose');

const { validationResult } = require('express-validator');

const fileHelper = require('../util/file');

const Product = require('../models/product');

exports.getAddProduct = (req, res, next) => {
    res.render('admin/edit-product', {
        pageTitle: 'Add Product',
        path: '/admin/add-product',
        editing: false,
        hasError: false,
        errorMessage: null,
        validationErrors: [],
    });
};

exports.postAddProduct = (req, res, next) => {
    const title = req.body.title;
    // const imageUrl = req.body.imageUrl;
    const image = req.file;
    const price = req.body.price;
    const description = req.body.description;

    if (!image) {
        return res.status(422).render('admin/edit-product', {
            pageTitle: 'Add Product',
            path: '/admin/add-product',
            editing: false,
            hasError: true,
            product: {
                title: title,
                price: price,
                description: description,
            },
            errorMessage: 'Attached file is not an image.',
            validationErrors: [],
        });
    }

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(422).render('admin/edit-product', {
            pageTitle: 'Add Product',
            path: '/admin/add-product',
            editing: false,
            hasError: true,
            product: {
                title: title,
                price: price,
                description: description,
            },
            errorMessage: errors.array()[0].msg,
            validationErrors: errors.array(),
        });
    }

    const imageUrl = image.path;

    const product = new Product({
        // _id: new monggose.Types.ObjectId('5fc8de0bd8266423e0bffec3'),
        title: title,
        imageUrl: imageUrl,
        price: price,
        description: description,
        // userId: req.user._id
        userId: req.user,
    });

    product
        .save()
        .then((result) => {
            // console.log(result);
            console.log('Created Product !');
            res.redirect('/admin/products');
        })
        .catch((err) => {
            // res.redirect('/500');
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
};

exports.getEditProduct = (req, res, next) => {
    const editMode = req.query.edit;

    if (!editMode) res.redirect('/');

    const prodId = req.params.productId;

    Product.findById(prodId)
        .then((product) => {
            if (!product) res.redirect('/');

            res.render('admin/edit-product', {
                pageTitle: 'Edit Product',
                path: '/admin/edit-product',
                editing: editMode,
                product: product,
                hasError: false,
                errorMessage: null,
                validationErrors: [],
            });
        })
        .catch((err) => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
};

exports.postEditProduct = (req, res, next) => {
    const prodId = req.body.productId;
    const updatedTitle = req.body.title;
    const image = req.file;
    const updatedPrice = req.body.price;
    const updatedDescription = req.body.description;
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(422).render('admin/edit-product', {
            pageTitle: 'Edit Product',
            path: '/admin/edit-product',
            editing: true,
            hasError: true,
            product: {
                title: updatedTitle,
                price: updatedPrice,
                description: updatedDescription,
                _id: prodId,
            },
            errorMessage: errors.array()[0].msg,
            validationErrors: errors.array(),
        });
    }

    Product.findById(prodId)
        .then((product) => {
            if (product.userId.toString() !== req.user._id.toString()) return res.redirect('/');

            product.title = updatedTitle;

            if (image) {
                fileHelper.deleteFile(product.imageUrl);
                product.imageUrl = image.path;
            }

            product.price = updatedPrice;
            product.description = updatedDescription;

            return product.save().then((result) => {
                console.log('Updated Product !');
                res.redirect('/admin/products');
            });
        })
        .catch((err) => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
};

exports.getProducts = (req, res, next) => {
    Product.find({ userId: req.user._id })
        // .select('title price -_id')
        // .populate('userId', 'name')
        .then((products) => {
            console.log(products);
            res.render('admin/products', {
                prods: products,
                pageTitle: 'Admin Products',
                path: '/admin/products',
            });
        })
        .catch((err) => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
};

exports.postDeleteProduct = (req, res, next) => {
    const prodId = req.body.productId;

    Product.findById(prodId)
        .then((product) => {
            if (!product) next(new Error('Product not found.'));

            fileHelper.deleteFile(product.imageUrl);

            return Product.deleteOne({ _id: prodId, userId: req.user._id });
        })
        .then((result) => {
            console.log('Destroyed Product !');
            res.redirect('/admin/products');
        })
        .catch((err) => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        });
};
