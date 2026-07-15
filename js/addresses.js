document.querySelectorAll(".tab-btn").forEach(btn=>{
    btn.addEventListener("click",function(){

        document.querySelectorAll(".tab-btn").forEach(tab=>tab.classList.remove("active"));
        this.classList.add("active");

        document.querySelectorAll(".tab-content").forEach(content=>content.classList.remove("active"));

        const target=this.dataset.tab;
        document.getElementById(target).classList.add("active");

        if(target==="add"){
            document.getElementById("edit-area").style.display="none";
        }
    });
});


function showEdit(name,receiver,phone,addr,detail,isDefault){

    const editArea=document.getElementById("edit-area");

    editArea.style.display="block";

    document.getElementById("editName").value=name;
    document.getElementById("editReceiver").value=receiver;
    document.getElementById("editPhone").value=phone;
    document.getElementById("editAddr").value=addr;
    document.getElementById("editDetail").value=detail;
    document.getElementById("editDefault").checked=isDefault;

    setTimeout(()=>{
        editArea.scrollIntoView({
            behavior:"smooth",
            block:"start"
        });
    },100);
}


function changeDefault(target){

    document.querySelectorAll(".default-address").forEach(box=>{
        if(box!==target){
            box.checked=false;
        }
    });

    if(target.checked){
        alert("기본 배송지가 변경되었습니다.");
    }
}



document.querySelector("#edit-area .btn-primary")
.addEventListener("click",function(e){

    e.preventDefault();

    const name=document.getElementById("editName").value;
    const receiver=document.getElementById("editReceiver").value;
    const phone=document.getElementById("editPhone").value;
    const addr=document.getElementById("editAddr").value;

    if(!name||!receiver||!phone||!addr){
        alert("필수 정보를 입력해주세요.");
        return;
    }

    if(document.getElementById("editDefault").checked){
        alert("기본 배송지로 수정되었습니다.");
    }else{
        alert("배송지가 수정되었습니다.");
    }

});



document.querySelector("#add .btn-primary")
.addEventListener("click",function(e){

    e.preventDefault();

    if(document.getElementById("addDefault").checked){
        alert("기본 배송지로 등록되었습니다.");
    }else{
        alert("배송지가 등록되었습니다.");
    }

});



let addressTarget="";


function openAddress(type){

    addressTarget=type;

    document.getElementById("address-modal")
    .style.display="flex";

}


function findAddress(){

    const keyword=document.getElementById("address-keyword").value;
    const result=document.getElementById("address-result");

    if(keyword.trim()===""){
        result.innerHTML="검색어를 입력해주세요.";
        return;
    }

    result.innerHTML=`

        <div class="address-item" onclick="selectAddress('서울특별시 성동구 왕십리로 100')">
            서울특별시 성동구 왕십리로 100
        </div>

        <div class="address-item" onclick="selectAddress('서울특별시 강남구 테헤란로 100')">
            서울특별시 강남구 테헤란로 100
        </div>

        <div class="address-item" onclick="selectAddress('서울특별시 송파구 올림픽로 300')">
            서울특별시 송파구 올림픽로 300
        </div>

    `;
}


function selectAddress(address){

    if(addressTarget==="add"){
        document.getElementById("addAddr").value=address;
    }

    if(addressTarget==="edit"){
        document.getElementById("editAddr").value=address;
    }

    closeAddress();
}



function closeAddress(){

    document.getElementById("address-modal").style.display="none";

    document.getElementById("address-keyword").value="";

    document.getElementById("address-result").innerHTML=
    "검색 결과가 표시됩니다.";

}