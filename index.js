//This is the back end of the program.
//Accessing the database, processing user inputs and connecting users is done here

const express = require('express');
const app = express();
const mongoose = require('mongoose');
const puppeteer = require('puppeteer');
var io;

app.use(express.static('public'));
app.set('view engine','ejs');

//DBAccess class handles access to the database
class DBAccess{
    static initialize(){
        //Declare objects used to perform queries in the database
        const categorySchema = new mongoose.Schema({
            name : String,
            imageSource : String,
            visible : Boolean
        });
        this.categoryModel = mongoose.model('Category', categorySchema);

        const productSchema = new mongoose.Schema({
            name : String,
            category : String,
            imageSource : String,
            visible : Boolean,
            unit : String,
            quantity : Number
        });
        this.productModel = mongoose.model('Product', productSchema);

        const listProductSchema = new mongoose.Schema({
            name : String,
            unit : String,
            quantity : Number,
            taken : Boolean
        });
        this.listProductModel = mongoose.model('ListProduct', listProductSchema);

        //Connect to the database
        const url = 'mongodb+srv://Per:HVOSDPWev9AYocyY@perliukai-4jawx.gcp.mongodb.net/data?retryWrites=true&w=majority';
        mongoose.set('useNewUrlParser', true);
        mongoose.set('useUnifiedTopology', true);
        mongoose.set('useFindAndModify', false);
        mongoose.connect(url, () => {
            console.log('connected to db');
        });
    }

    //Find categories that pass a given filter
    static findCategories(filter){
        return this.categoryModel.find(filter).sort('name').exec()
        .then(categories => { return categories; });
    }

    //Create and save a category of a given name
    static saveCategory(name){
        const data = {name : name, visible : true};
        const newCategory = new this.categoryModel(data);
        newCategory.save();
    }

    //Apply a provided update to a category of the given name
    static async updateCategory(name, update){
        await this.categoryModel.findOneAndUpdate({name : name}, update);
    }

    //Find products that pass a given filter
    static findProducts(filter){
        return this.productModel.find(filter).sort('name').exec()
        .then(products => { return products; });
    }

    //Create and save a product of a given name
    static saveProduct(data){
        data.visible = true;
        const newProduct = new this.productModel(data);
        newProduct.save();
    }

    //Apply a provided update to a category that passes the given filter
    static async updateProduct(filter, update){
        console.log(filter);
        await this.productModel.findOneAndUpdate(filter, update);
    }

    //Find a products in the shopping list that match a given filter
    static findListProducts(filter){
        if(filter.unit === '') filter.unit = ' ';
        return this.listProductModel.find(filter).sort('name').exec()
        .then(listProducts => { return listProducts; });
    }

    //Create and save a product in the shopping list
    static saveListProduct(data){
        data.taken = false;
        if(data.unit === '') data.unit = ' ';
        const newListProduct = new this.listProductModel(data);
        newListProduct.save();
    }

    //Apply a given update to a product in the shoppint list that passes a given filter
    static async updateListProduct(filter, update){
        if(filter.unit === '') filter.unit = ' ';
        await this.listProductModel.findOneAndUpdate(filter, update);
    }

    //Remove a product from the shopping list that passes a given filter
    static async removeListProduct(filter){
        if(filter.unit === '') filter.unit = ' ';
        await this.listProductModel.deleteMany(filter);
    }
}

//The server class handles initializing and maintaining the functions of the server
class Server{
    
    //Initialize this class
    static initialize(){
        this.createCategoryRoutes();
        this.startServer();
        this.buildSockets();
    }

    //Start the server, allow it to communicate over HTTP
    static startServer(){
        const PORT = process.env.PORT || 3000;
        const server = app.listen(PORT, () => {
            console.log(`server started on port ${PORT}`);
        });
        io = require('socket.io')(server);

        //Declare directory route
        app.get('/directory', async(req, res) => {
            const categories = await DBAccess.findCategories({visible: true});

            //If an image of any category in the directory has not been found, look for it again
            categories.forEach(category => {
                if(!category.imageSource) WebScraper.scrapeImage(category.name);
            })
            res.render('directory', {categories : categories});
        });

        //Declare shopping list route
        app.get('/', async(req, res) => {
            const listItems = await DBAccess.findListProducts({});
            res.render('shoppingList', {products : listItems});
        });
    }

    //Build sockets used for accepting requests from clients
    static buildSockets(){
        io.on('connection', socket => {
            socket.on('addCategory', data => { Main.addCategory(socket, data.category); });

            socket.on('removeCategory', data => { Main.removeCategory(data.category); });

            socket.on('addProduct', data => { Main.addProduct(socket, data); });

            socket.on('removeProduct', data => { Main.removeProduct(data); });

            socket.on('addToShoppingList', data => { Main.addToShoppingList(socket, data); });

            socket.on('toggleTaken', data => { Main.toggleTaken(data); });

            socket.on('reduceQuantity', data => { Main.reduceQuantity(data); });

            socket.on('removeAll', () => { Main.removeAll(); });

            socket.on('removeTaken', () => { Main.removeTaken() });
        })
    }

    //Calls a request to create a route for each category at startup of server
    static async createCategoryRoutes(){
        const categories = await DBAccess.findCategories();
        for(let category of categories){
            this.createCategoryRoute(category.name);
        }
    }

    //Create the route
    static createCategoryRoute(category){
        const route = category.replace(/ /g, '%20');
        app.get(`/category/${route}`, async(req, res) => {
            const products = await DBAccess.findProducts({category : category, visible : true});
            
            //If an image of any product in this category has not been found, look for it again
            products.forEach(product => {
                if(!product.imageSource) WebScraper.scrapeImage(product.name, product.category);
            })
            res.render('category', {category : category, products : products});
        });
    }
}

//Main class processes requests, computes results and sends them to the client
class Main{
    //Initialize variables in the class
    static initialize(){
        this.units = ['g','kg', 'ml', 'l', ' '];
        this.minimum = [100, 1, 100, 1, 1];
    }

    //Sends a response to the client
    static sendData(address, resObject, socket){

        //If a socket is provided, send the response only to who sent the request
        if(socket){
            socket.emit(address, resObject);
        }
        else{
            io.emit(address, resObject);
        }
    }

    //Add a category
    static async addCategory(socket, name){

        //Check to see if such a category already exists
        const category = await DBAccess.findCategories({name : name});

        //If such a category does not exist, create one
        if(category.length === 0){
            Server.createCategoryRoute(name);
            DBAccess.saveCategory(name);
            this.sendData('addCategory', {category : name});
            WebScraper.scrapeImage(name);
        } else {
            //If such a category does exist but it has been removed, bring it back
            if(category[0].visible === false){
                this.sendData('addCategory', {category : name});
                DBAccess.updateCategory(name, {visible : true});
            }
            //If such a category does exist and it has not been removed, throw an error
            else {
                this.sendData('errormsg', {errorMessage : 'Already exists'}, socket);
            }
        }
    }

    //Removes a category of a given name
    static async removeCategory(name){
        DBAccess.updateCategory(name, {visible : false});
        this.sendData('removeCategory', {category : name});
    }

    //Add a product that matches the given data
    static async addProduct(socket, data){
        //Check if such a product already exists
        const product = await DBAccess.findProducts(data);

        //If such a product does not exist, create that product
        if(product.length === 0){
            this.sendData(`addProduct${data.category}`, data);
            DBAccess.saveProduct(data);
            WebScraper.scrapeImage(data.name, data.category);
        } else {
            //If such a product exists but is removed, bring it back
            if(product[0].visible === false){
                this.sendData(`addProduct${data.category}`, data);
                DBAccess.updateProduct(data, {visible : true});
            }
            //If such a product exists and is visible, throw and error
            else {
                this.sendData('errormsg', {errorMessage : 'Already exists'}, socket);
            }
        }
    }

    //Remove a product that matches the given data
    static async removeProduct(data){
        DBAccess.updateProduct(data, {visible : false});
        this.sendData(`removeProduct${data.category}`, data);
    }

    //Add a product to the shopping list that matches the given data
    static async addToShoppingList(socket, data){
        this.sendData('addToShoppingList', data);

        //Check if such a product in the list already exists
        const product = await DBAccess.findListProducts({name : data.name, unit : data.unit});
        
        //Send a response to the client that added the product informing them of the new quantity of this item in the list
        if(product[0]){
            this.sendData('listProductUpdate', {
                quantity : parseFloat(data.quantity) + parseFloat(product[0].quantity), 
                unit : data.unit}, socket);
            DBAccess.updateListProduct({name : data.name, unit : data.unit}, {$inc : {'quantity' : data.quantity}});
        } else {
            this.sendData('listProductUpdate', {quantity : data.quantity, unit : data.unit}, socket);
            DBAccess.saveListProduct(data);
        }
    }

    //Toggle whether a product in the shopping list is taken
    static async toggleTaken(data){
        const product = await DBAccess.findListProducts(data);
        if(product[0].taken === true){
            DBAccess.updateListProduct(data, {taken : false});
            data.taken = false;
            this.sendData('updateListProduct', data);
        } else {
            DBAccess.updateListProduct(data, {taken : true});
            data.taken = true;
            this.sendData('updateListProduct', data);
        }
    }

    //Reduce the quantity of an item in the shopping list
    static async reduceQuantity(data){
        const product = await DBAccess.findListProducts(data);
        this.sendData('reduceQuantity', data);
        
        //Get the minimum amount of this particular unit
        const index = this.units.indexOf(data.unit);
        
        //If the amount is already at a minimum, remove that product from the shopping list
        if(product[0].quantity === this.minimum[index]){ 
            DBAccess.removeListProduct(data); 
        }
        //If the amount is not already at a minimum, reduce the amount of that product by a preset amount
        else { 
            DBAccess.updateListProduct(data, {$inc : {'quantity': -this.minimum[index]}});
        }
    }

    //Remove all the products from the list
    static removeAll(){
        DBAccess.removeListProduct({});
        this.sendData('removeAll');
    }

    //Remove all the products from the list that have been marked as taken
    static removeTaken(){
        DBAccess.removeListProduct({taken : true});
        this.sendData('removeTaken');
    }

    static newImage(url, name, category){
        console.log(url);
        if(category){
            DBAccess.updateProduct({name : name, category : category}, {imageSource : url});
            Main.sendData(`updateImage${category}`, {product : name, imageSource : url});
        }
        else{
            DBAccess.updateCategory(name, {imageSource : url});
            Main.sendData('updateImage', {category : name, imageSource : url});
        }
    }
}

//This class handles finding images online
class WebScraper{
    //Retrieves the link of the first image that matches a provided name on yandex.com
    static async scrapeImage(name, category){
        const url = `https://yandex.com/images/search?text=${name}&isize=small`;
        puppeteer.launch({
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
            ],
          }).then(async browser => {
            //Try to find the product
            try{
                const page = await browser.newPage();
                await page.goto(url, {waitUntil: 'load', timeout: 0});

                //Navigate to where the section containing the link to the image is
                var [el] = await page.$x('/html/body/div[6]/div[1]/div[1]/div[1]/div/div[1]/div/a');
                
                //Try a different location if the previous one fails
                if(!el){
                    [el] = await page.$x('/html/body/div[6]/div[1]/div[1]/div[2]/div/div[1]/div/a');
                }
                const url2 = await el.getProperty('href');
                const url2text = await url2.jsonValue();

                await page.goto(url2text, {waitUntil: 'load', timeout: 0});
                //Navigate to where the link to the image is
                const [el2] = await page.$x('/html/body/div[14]/div/div/div/div[3]/div/div[1]/div[1]/div[3]/div/img');
                const src = await el2.getProperty('src');
                const imageURL = await src.jsonValue();

                browser.close();

                //Process the image once it has been retrieved
                Main.newImage(imageURL, name, category);

            //If an unforeseen error occurs, will try again later
            } catch (e) { console.log(e);
            }
        })
        .catch(err => { console.log(err)});
    }
}

//Initialize all main methods
DBAccess.initialize();
Server.initialize();
Main.initialize();