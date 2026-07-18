// Sheger Bingo Script


let calledNumbers = [];

let currentCard = 1;



// MENU

function openMenu(){

    document
    .getElementById("menu")
    .classList
    .toggle("hidden");

}



function darkMode(){

    document.body.classList.toggle("dark");

}





// CREATE BINGO CARD

function createCard(cardNumber=1){

    currentCard = cardNumber;

    document.getElementById("cardTitle").innerHTML =
    "ካርቴላ " + cardNumber;


    let card = document.getElementById("card");

    card.innerHTML="";


    let letters=["B","I","N","G","O"];


    letters.forEach(letter=>{

        let cell=document.createElement("div");

        cell.className="cell head";

        cell.innerHTML=letter;

        card.appendChild(cell);

    });



    let numbers=[];


    for(let i=1;i<=75;i++){

        numbers.push(i);

    }



    for(let i=0;i<25;i++){


        let cell=document.createElement("div");

        cell.className="cell";


        if(i===12){

            cell.innerHTML="FREE";

            cell.classList.add("free");

        }

        else{


            let index=Math.floor(
                Math.random()*numbers.length
            );


            let number=numbers[index];


            numbers.splice(index,1);


            cell.innerHTML=number;


            cell.dataset.number=number;


        }


        card.appendChild(cell);


    }


}





// SHOW 250 CARDS


function showCards(){


    let box=document
    .getElementById("cards");


    box.classList.toggle("hidden");



    let list=document
    .getElementById("list");


    list.innerHTML="";



    for(let i=1;i<=250;i++){


        let btn=document.createElement("button");


        if(i===48 || i===68){

            btn.innerHTML=
            "⭐ Admin ካርቴላ "+i;

        }

        else{

            btn.innerHTML=
            "ካርቴላ "+i;

        }



        btn.onclick=function(){

            createCard(i);

        };


        list.appendChild(btn);


    }

}





// CALL NUMBER


function callNumber(){


    if(calledNumbers.length>=75){

        alert("ሁሉም ቁጥሮች ተጠርተዋል");

        return;

    }



    let num;


    do{

        num=Math.floor(Math.random()*75)+1;


    }

    while(
        calledNumbers.includes(num)
    );



    calledNumbers.push(num);



    document
    .getElementById("activeNumber")
    .innerHTML=num;




    let circle=document.createElement("div");


    circle.className="circle";


    circle.innerHTML=num;



    document
    .getElementById("called")
    .appendChild(circle);



    markNumber(num);


}





// AUTO MARK


function markNumber(num){


    let cells=
    document.querySelectorAll(".cell");



    cells.forEach(cell=>{


        if(cell.dataset.number==num){


            cell.classList.add("marked");


        }


    });



    checkBingo();


}





// CHECK BINGO


function checkBingo(){


    let cells=
    document.querySelectorAll(
        "#card .cell:not(.head)"
    );


    let count=0;



    cells.forEach(cell=>{


        if(
        cell.classList.contains("marked")
        ||
        cell.classList.contains("free")
        ){

            count++;

        }


    });



    if(count===25){


        alert(
        "🎉 BINGO! አሸናፊ ነህ!"
        );


    }


}






// PRIZE CALCULATOR


function calculatePrize(){


    let total=
    Number(
    document.getElementById("players").value
    );



    if(total<=0){

        return;

    }



    let owner =
    total * 0.25;



    let winner =
    total * 0.75;



    document
    .getElementById("result")
    .innerHTML=

    "የአንተ 25%: "
    +owner+
    " ብር <br>"+
    "የአሸናፊ 75%: "
    +winner+
    " ብር";


}







// DEPOSIT


function sendDeposit(){


    let amount=
    document.getElementById("depositAmount").value;


    let proof=
    document.getElementById("depositProof").value;



    if(!amount || !proof){

        alert("ሁሉንም ሙላ");

        return;

    }



    alert(
    "Deposit ተልኳል ✅"
    );


}






// WITHDRAW


function sendWithdraw(){


    let amount=
    Number(
    document.getElementById("withdrawAmount").value
    );


    let account=
    document.getElementById("withdrawAccount").value;



    if(amount < 200){

        alert(
        "ከ200 ብር በታች Withdraw አይቻልም"
        );

        return;

    }



    if(!account){

        alert(
        "የክፍያ መረጃ ሙላ"
        );

        return;

    }



    alert(
    "Withdraw ጥያቄ ተልኳል ✅"
    );


}
window.onload=function(){
    createCard(1);
};





// START

createCard();window.onload = function(){

    createCard(1);

};setInterval(function(){
    callNumber();
},5000);
