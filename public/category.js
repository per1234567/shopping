//This file is responsible for the working of each category page

//The error class throws and hides errors
class Error{
    //Retrieve the location of the error bar on the page
    static initialize(){
        this.errorMessage = document.getElementById('errorMessage');
    }

    //Display the error
    static throw(text){
        this.lastThrow = new Date();
        this.errorMessage.classList.add('visible');
        this.errorMessage.innerText = text;
        setTimeout(() => {
            const now = new Date();

            //If a new error has not been thrown within the last 5 seconds, hide the error bar
            if(now - this.lastThrow >= 4990) this.hide();
        }, 5000);
    }

    //Hide the error
    static hide(){
        this.errorMessage.classList.remove('visible');
    }
}

//This class is responsible for the working of the dropdown menu
class Dropdown{
    //Initializes the class
    static initialize(){
        this.dropdownMenu = document.getElementById('dropdownMenu');
        this.toggledropdown = document.getElementById('toggleDropdown');

        //Assigns minimum quantities for each unit
        this.names = ['g','kg','ml','l',' '];
        this.quantity = [100, 1, 100, 1, 1];

        //Call the methods in this class
        this.dropdownMenuItems();
        this.toggleDropdown();
    }

    //Toggle the visibility of the dropdown menu
    static toggleDropdown(){
        this.toggledropdown.addEventListener('click', () => {
            dropdownMenu.classList.toggle('visible');
        });
    }

    //This creates options in the dropdown menu from the units and quantities initialized before
    static dropdownMenuItems(){
        var option;
        for(var i = 0; i < this.names.length; i++){
            //Create each HTML object
            option = document.createElement('li');
            option.setAttribute('name', this.names[i]);
            option.setAttribute('quantity', this.quantity[i]);
            option.innerHTML = 
            `<input class = dropdownMenuItem type = 'submit' 
                    value = '${this.quantity[i]} ${this.names[i]}'>`;

            //Add scripts to each of these new objects
            this.dropdownMenuItem(option);
            this.dropdownMenu.appendChild(option);
        }
    }

    //When clicked on an item from the dropdown menu, 
    //it will close and the selection will be saved the button opening the dropdown menu
    static dropdownMenuItem(option){
        option.addEventListener('click', () => {
            this.toggledropdown.value = `${option.getAttribute('quantity')} ${option.getAttribute('name')}`;
            this.dropdownMenu.classList.toggle('visible');
        });
    }
}

//This class is responsible for adding scripts to objects on the webpage
class CategoryScripts{

    //Initialize this class
    static initialize(){
        this.addproduct = document.getElementById('addProduct');
        this.textInput = document.getElementById('textInput');
        this.hideWindow = document.getElementById('hideWindow');
        this.inputWindow = document.getElementById('inputWindow');
        this.toggledropdown = document.getElementById('toggleDropdown');
        this.blocks = document.getElementsByClassName('block');
        
        //This object is responsible for allowing the program to detect globally when a text input is entered
        this.textInputValue = {
            value: '',
            aListener: function(val) {},
            set a(newValue) {
              this.value = newValue;
              this.aListener(newValue);
            },
            get a() {
              return this.value;
            },
            awaitUpdate: function(update) {
              this.aListener = update;
            }
        }

        //Call methods in this class
        this.addProduct();
        this.productClicks();
    }

    //This method is responsible for accepting the input of adding a new product to this category
    static addProduct(){

        //When the user presses enter, accept their input
        this.textInput.addEventListener('keyup', keyPress => {
            if(keyPress.key === 'Enter'){
                this.inputWindow.style.display = 'none';
                this.textInputValue.a = textInput.value;
            }
        });

        //Allow for the menu to user input to open
        this.addproduct.addEventListener('click', () => {
            this.inputWindow.style.display = 'inline';

            //Wait for the user to click enter
            this.textInputValue.awaitUpdate(name => {

                //Validate the input
                if(name === ''){ Error.throw('Enter a name'); }
                else if(name[0] === ' '){ Error.throw('Name cannot start with a space'); }
                else if(this.toggledropdown.value === 'select unit'){ Error.throw('No unit selected'); }
                else{
                    const data = this.toggledropdown.value.split(' ');
                    CategoryMain.sendData('addProduct', 
                    {category : document.title, name : name, quantity : data[0], unit : data[1]});
                }
            });
        });

        //When the X is clicked, close the input window
        this.hideWindow.addEventListener('click', () => {
            inputWindow.style.display = 'none';
        });
    }

    //Call the click method on each block
    //This is necessary, because a newly created product will have only the click method applied on it
    static productClicks(){
        for(let block of this.blocks){
            this.click(block);
        }
    }

    //Long click/tap removes the product, short click adds it to the shopping list
    static click(block){

        //Detect long click/tap
        block.addEventListener('mousedown', () => {
            this.lastClick = new Date();
            block.classList.add('clicked');
            setTimeout(() => {
                var clickNow = new Date();

                //If last clicked/tapped more that 3 seconds ago, send a request to the server to remove this product
                if(clickNow - this.lastClick >= 2990)
                    CategoryMain.sendData('removeProduct', {
                        category : document.title,
                        name : block.getAttribute('name'),
                        quantity : block.getAttribute('quantity'),
                        unit: block.getAttribute('unit')
                    });
            }, 3000);
        });

        //A short click/tap will add the product to the shopping list
        block.addEventListener('mouseup', click => {
            var clickNow = new Date();

            //If the product has been clicked/pressed for less than 0.2 seconds,
            //Add it to the shopping list
            if(clickNow - this.lastClick < 200){
                const data = {
                    name : block.getAttribute('name'),
                    quantity : block.getAttribute('quantity'),
                    unit: block.getAttribute('unit'),
                    category: document.title
                };
                CategoryMain.sendData('addToShoppingList', data);
            }

            //When unpressed, a long click will no longer register
            this.lastClick += 100000;
            block.classList.remove('clicked');
        });

        //If the mouse/finger hovers off the tile, a long click will no longer register
        block.addEventListener('mouseout', () => {
            this.lastClick += 100000;
            block.classList.remove('clicked');
        });
    }
}

//This class is responsible for logical processing and sending requests to the server
class CategoryMain{
    //Initialize objects used in this class, call initialization methods
    static initialize(){
        this.socket = io();

        this.createSockets();
        this.products = document.getElementById('products');
    }

    //Send data to the server
    static sendData(request, data){
        this.socket.emit(request, data);
    }

    //Create the sockets used for receiving data from the server
    static createSockets(){
        this.socket.on('errormsg', data => { Error.throw(data.errorMessage); });

        this.socket.on(`addProduct${document.title}`, data => { this.addProduct(data); });

        this.socket.on(`removeProduct${document.title}`, data => { this.removeProduct(data); });

        this.socket.on(`updateImage${document.title}`, data => { this.updateImage(data); });

        this.socket.on('listProductUpdate', data => { this.listProductUpdate(data); });
    }

    //This method performs the action of displaying a new product in the category
    static addProduct(data){
        
        //Create the HTML object
        const newProduct = document.createElement('li');
        newProduct.classList.add('block');
        newProduct.setAttribute('name', data.name);
        newProduct.setAttribute('quantity', data.quantity);
        newProduct.setAttribute('unit', data.unit);
        newProduct.innerHTML = 
        `<div id = 'loading'></div>
        <div id = 'blockCenter'>
            <span class = 'topText' name = '${data.name}'>${data.name}</span>
            <span class = 'bottomText' name = '${data.name}'>${data.quantity} ${data.unit}</span>
        </div>`

        //Apply scripts on this new object
        CategoryScripts.click(newProduct);

        //Insert the product in the alphabetically appropriate place
        for(let product of this.products.children){

            //If the next product's name is lexicographically smaller, insert the new product here
            if(data.name < product.getAttribute('name')){
                this.products.insertBefore(newProduct, product);
                return;
            }
        }

        //If such a product was not found, insert it at the end of the list
        this.products.appendChild(newProduct);
    }

    //Removes a product from the category
    static removeProduct(data){
        const product = document.querySelector(
            `[name = '${data.name}'][quantity = '${data.quantity}'][unit = '${data.unit}']`
        );
        product.remove();
    }

    //Updates the images of all products in the category that match the data provided
    static updateImage(data){
        const products = document.querySelectorAll(`[name = '${data.product}'][class = 'block']`);
        for(let product of products){
            product.style.backgroundImage = `url('${data.imageSource}')`;
        }
    }

    //Operation of a sidebar informing the user of an update in the shopping list
    static listProductUpdate(data){
        this.lastOpen = new Date();
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.add('open');
        sidebar.innerText = `${data.quantity} ${data.unit}`;

        //If a new update has not been displayed within the last 2 seconds, close this sidebar
        setTimeout(() => {
            const nowOpen = new Date();
            if(nowOpen - this.lastOpen >= 1990) sidebar.classList.remove('open');
        }, 2000);
    }
}

//Initialize the classes on this web page
CategoryScripts.initialize();
CategoryMain.initialize();
Error.initialize();
Dropdown.initialize();