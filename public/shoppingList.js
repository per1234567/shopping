//This file is responsible for the working of the shopping list page

//This class is responsible for adding scripts to objects on the webpage
class ListScripts{
    //Initializes the objects on this webpage
    static initialize(){
        const products = document.getElementsByClassName('product');

        //Call a method providing functionality on each product in the list
        for(let product of products){
            this.toggleTaken(product.firstElementChild);
            this.reduceQuantity(product.lastElementChild);
        }

        //Apply functionality to buttons performing bulk actions
        this.removeAll();
        this.removeTaken();
    }

    //Toggle whether a product in the shopping list is taken
    static toggleTaken(product){
        product.addEventListener('click', () => {
            ShoppingListMain.sendData('toggleTaken', 
            {name : product.parentElement.getAttribute('name'), unit : product.parentElement.getAttribute('unit')});
        });
    }

    //Detect a long click/tap on an item and perform the provided function
    static longClick(item, target, request, delay, data){
        item.addEventListener('mousedown', () => {
            this.lastClick = new Date();
            target.classList.add('clicked');
            
            //If the user has last clicked not less than the provided delay ago, register the long click
            setTimeout(() => {
                var clickNow = new Date();
                if(clickNow - this.lastClick >= delay - 5){
                    ShoppingListMain.sendData(request, data);
                }
            }, delay);
        });

        //If the user clicks/taps off, the long click will not be registered
        item.addEventListener('mouseup', () => {
            this.lastClick += 100000;
            target.classList.remove('clicked');
        });

        //If the user hovers off, the long click will not be registered
        item.addEventListener('mouseout', () => {
            this.lastClick += 100000;
            target.classList.remove('clicked');
        });

        //Equivalent for touch controls
        item.addEventListener('touchstart', () => {
            this.lastClick = new Date();
            target.classList.add('clicked');
            setTimeout(() => {
                var clickNow = new Date();
                if(clickNow - this.lastClick >= delay - 5){
                    ShoppingListMain.sendData(request, data);
                }
            }, delay);
        });

        item.addEventListener('touchend', () => {
            this.lastClick += 100000;
            target.classList.remove('clicked');
        });
    }
    
    //Adds functionality to reduce the amount of a product in the shopping list
    static reduceQuantity(product){
        this.longClick(product, product, 'reduceQuantity', 1000, {
            name : product.parentElement.getAttribute('name'), 
            unit : product.parentElement.getAttribute('unit')}
        );
    }

    //Adds functionality to the button that removes all the products from the shopping list
    static removeAll(){
        const removeAll = document.getElementById('removeAll');
        this.longClick(removeAll, removeAll.parentElement, 'removeAll', 3000, {});
    }

    //Adds functionality to the button that removes products marked as taken from the shopping list
    static removeTaken(){
        const removeTaken = document.getElementById('removeTaken');
        this.longClick(removeTaken, removeTaken.parentElement, 'removeTaken', 3000, {});
    }
}

//This class is responsible for logical processing and sending requests to the server
class ShoppingListMain{

    //Initialize objects used in this class and call the createSockets method
    static initialize(){
        this.socket = io();
        this.createSockets();
        this.products = document.getElementById('products');

        this.units = ['g','kg','ml','l',' '];
        this.minimum = [100, 1, 100, 1, 1];
    }

    //Send data to the server
    static sendData(request, data){
        this.socket.emit(request, data);
    }

    //Create the sockets used for accepting a request from the server
    static createSockets(){
        this.socket.on('addToShoppingList', data => { this.addToList(data); });

        this.socket.on('updateListProduct', data => { this.updateListProduct(data); });

        this.socket.on('reduceQuantity', data => { this.reduceQuantity(data); });

        this.socket.on('removeTaken', () => { this.removeTaken() });

        this.socket.on('removeAll', () => { this.removeAll(); });
    }

    //Reduce the quantity of a product
    static reduceQuantity(data){
        const product = document.querySelector(`[name = '${data.name}'][unit = '${data.unit}']`);
        const parameters = product.lastElementChild.innerText.split(' ');
        const index = this.units.indexOf(data.unit);
        parameters[0] -= this.minimum[index];
        if(parameters[0] === 0){
            if(product.previousElementSibling.tagName == 'H1'){
                if(!product.nextElementSibling || product.nextElementSibling.tagName == 'H1'){
                    product.previousElementSibling.remove();
                }
            }
            product.remove();
        }
        else product.lastElementChild.lastElementChild.innerText = `${parameters[0]} ${parameters[1]}`;
    }

    //Add a product to this new shopping list
    static addToList(data){
        data.category = data.category.charAt(0).toUpperCase() + data.category.slice(1);
        if(data.unit === '') data.unit = ' ';
        const product = document.querySelector(`[name = '${data.name}'][unit = '${data.unit}']`);

        //If the product already exists, increase its quantity
        if(product){
            const parameters = product.lastElementChild.lastElementChild;
            const parameterText = parameters.innerText.split(' ');
            parameters.innerText = `${parseFloat(parameterText[0]) + parseFloat(data.quantity)} ${parameterText[1]}`;
        }
        //Otherwise, create and add it
        else{
            //Create a new HTML object
            const newProduct = document.createElement('li');
            newProduct.setAttribute('class', 'product');
            newProduct.setAttribute('name', data.name);
            newProduct.setAttribute('unit', data.unit);
            newProduct.innerHTML = 
            `<span id = 'text'>${data.name}</span>
            <div id = parameterContainer>
                <div id = 'loading'></div>
                <span id = 'parameters'>${data.quantity} ${data.unit}</span>
            </div>`;

            //Apply scripts to it
            ListScripts.reduceQuantity(newProduct.lastElementChild);
            ListScripts.toggleTaken(newProduct.firstElementChild);

            //Create a heading for a new category, in case it will have to be appended
            const categoryName = document.createElement('h1');
            categoryName.innerText = data.category;

            const productList = this.products.children;
            var categoryInserted = false;
            var thisCategory;

            //Iterate through the list to find the category where the new product should be inserted
            for(var i = 0; i < productList.length; i++){
                if(productList[i].tagName == 'H1'){
                    if(data.category == productList[i].textContent){
                        thisCategory = i + 1;
                        categoryInserted = true;
                        break;
                    }
                    if(data.category < productList[i].textContent){
                        this.products.insertBefore(categoryName, productList[i]);
                        categoryInserted = true;
                        thisCategory = i + 1;
                        break;
                    }
                }
            }
            //If no such category was found, insert it at the end
            if(categoryInserted === false){
                this.products.appendChild(categoryName);
                this.products.appendChild(newProduct);
                return;
            }
            //Iterate throught the products to find where it should be inserted alphabetically
            for(var i = thisCategory; i < productList.length; i++){
                if(productList[i].tagName == 'H1' || data.name < productList[i].getAttribute('name')){
                    this.products.insertBefore(newProduct, productList[i]);
                    return;
                }
            }
            //If no such position was found, insert it at the end
            this.products.appendChild(newProduct);
        }
    }

    //Toggle whether a product in the list is taken
    static updateListProduct(data){
        const product = document.querySelector(`[name = '${data.name}'][unit = '${data.unit}']`);
        if(data.taken === true){
            product.classList.add('taken');
        } else {
            product.classList.remove('taken');
        }
    }

    //Remove all products from the shopping list
    static removeAll(){
        this.products.innerHTML = '';
    }

    //Remove all products from the shopping list
    static removeTaken(){
        const products = document.getElementById('products').children;
        for(let i = 0; i < products.length; i++){
            if(products[i].getAttribute('class') === 'product taken'){
                
                //If there are no more items left in this category, remove its heading
                if(products[i].previousElementSibling.tagName == 'H1'){
                    if(!products[i].nextElementSibling || products[i].nextElementSibling.tagName == 'H1'){
                        products[i].previousElementSibling.remove();
                        i--;
                    }
                }
                products[i].remove();
                i--;
            }
        }
    }
}

//Initialize all the classes on this webpage
ShoppingListMain.initialize();
ListScripts.initialize();