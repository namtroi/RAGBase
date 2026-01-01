let slideIndex = 1;
let slideInterval;

// Initialize slideshow
showSlides(slideIndex);
startAutoShow();

// Next/previous controls
function plusSlides(n) {
  showSlides(slideIndex += n);
  resetAutoShow();
}

// Thumbnail image controls
function currentSlide(n) {
  showSlides(slideIndex = n);
  resetAutoShow();
}

function showSlides(n) {
  let i;
  let slides = document.getElementsByClassName("slide");
  let dots = document.getElementsByClassName("dot");
  
  if (n > slides.length) {slideIndex = 1}    
  if (n < 1) {slideIndex = slides.length}
  
  for (i = 0; i < slides.length; i++) {
    slides[i].style.display = "none";  
    slides[i].className = slides[i].className.replace(" active", "");
  }
  
  for (i = 0; i < dots.length; i++) {
    dots[i].className = dots[i].className.replace(" active", "");
  }
  
  slides[slideIndex-1].style.display = "block";
  // Add slight delay to add active class for potential CSS transitions if needed, 
  // though display:block vs none controls visibility primarily here.
  slides[slideIndex-1].className += " active";
  dots[slideIndex-1].className += " active";
}

function startAutoShow() {
    slideInterval = setInterval(function() {
        plusSlides(1);
    }, 4000); // Change image every 4 seconds
}

function resetAutoShow() {
    clearInterval(slideInterval);
    startAutoShow();
}
