// Bingo Table መፍጠር

let columns = {
    B: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
    I: [16,17,18,19,20,21,22,23,24,25,26,27,28,29,30],
    N: [31,32,33,34,35,36,37,38,39,40,41,42,43,44,45],
    G: [46,47,48,49,50,51,52,53,54,55,56,57,58,59,60],
    O: [61,62,63,64,65,66,67,68,69,70,71,72,73,74,75]
};


let table = document.getElementById("bingoTable");


for(let i=0;i<15;i++){

    let row = document.createElement("tr");


    for(let col in columns){

        let cell = document.createElement("td");

        cell.innerHTML = columns[col][i];

        cell.dataset.number = columns[col][i];

        row.appendChild(cell);

    }


    table.appendChild(row);

}




// Bingo Machine

let calledNumbers = [];



function callNumber(){

    if(calledNumbers.length >= 75){

        alert("ሁሉም ቁጥሮች ተጠርተዋል");
        return;

    }


    let number;


    do{

        number = Math.floor(Math.random()*75)+1;

    }

    while(calledNumbers.includes(number));



    calledNumbers.push(number);



    // B/I/N/G/O ማስቀመጥ

    let letter;


    if(number<=15){
        letter="B";
    }
    else if(number<=30){
        letter="I";
    }
    else if(number<=45){
        letter="N";
    }
    else if(number<=60){
        letter="G";
    }
    else{
        letter="O";
    }



    document.getElementById("activeNumber").innerHTML =
    letter + "-" + number;



    // table ላይ ማጥቆር

    let cells=document.querySelectorAll("#bingoTable td");


    cells.forEach(cell=>{

        if(cell.dataset.number == number){

            cell.classList.add("active");

        }

    });



    // የተጠሩ ቁጥሮች

    let circle=document.createElement("div");

    circle.className="numberCircle";

    circle.innerHTML=letter+"-"+number;


    document.getElementById("calledNumbers")
    .appendChild(circle);


}



// Auto Caller

setInterval(()=>{

    callNumber();

},5000);
let selectedCards=[];


function openCards(){

let box=document.getElementById("cardList");

box.classList.toggle("hidden");


let cards=document.getElementById("cards");

cards.innerHTML="";


for(let i=1;i<=250;i++){

let btn=document.createElement("button");

btn.innerHTML=""+i;

btn.className="cardButton";


btn.onclick=function(){

selectCard(i,btn);

};


cards.appendChild(btn);

}

}




function selectCard(number,button){


if(selectedCards.includes(number)){

selectedCards=
selectedCards.filter(c=>c!==number);

button.classList.remove("selectedCard");


}else{


selectedCards.push(number);

button.classList.add("selectedCard");


}



document.getElementById("selectedCount")
.innerHTML=selectedCards.length;



document.getElementById("cardPrice")
.innerHTML=selectedCards.length*10;


}
function createMyCard(cardNumber){


let box=document.getElementById("myCards");


let card=document.createElement("div");

card.className="bingoCard";


let letters=["B","I","N","G","O"];


letters.forEach(l=>{

let cell=document.createElement("div");

cell.className="bingoCell bingoHead";

cell.innerHTML=l;

card.appendChild(cell);

});



let ranges=[

[1,15],
[16,30],
[31,45],
[46,60],
[61,75]

];



for(let row=0;row<5;row++){


for(let col=0;col<5;col++){


let cell=document.createElement("div");

cell.className="bingoCell";



if(row==2 && col==2){

cell.innerHTML="FREE";

cell.classList.add("free");


}else{


let min=ranges[col][0];

let max=ranges[col][1];


let num=Math.floor(
Math.random()*(max-min+1)
)+min;


cell.innerHTML=num;

cell.dataset.number=num;


}


card.appendChild(cell);


}

}



box.appendChild(card);


}




// የተጠራ ቁጥር ካርቴላ ላይ መጥቆር

function markCard(number){


let cells=document.querySelectorAll(".bingoCell");


cells.forEach(cell=>{


if(cell.dataset.number==number){

cell.classList.add("marked");

}


});


}
