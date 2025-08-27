// Tag interaction enhancements
document.addEventListener('DOMContentLoaded', function() {
    console.log('Tag interactions script loaded');
    
    // Add CSS animations first
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .subcategory-tag.tag-active {
            transform: scale(1.1);
            box-shadow: 0 6px 12px rgba(0,0,0,0.2);
        }
        
        .post-list-with-tags li {
            transition: opacity 0.3s ease, transform 0.3s ease;
        }
        
        .subcategory-tag {
            cursor: pointer;
            user-select: none;
        }
    `;
    document.head.appendChild(style);
    
    // Add click functionality to tags for filtering
    const tags = document.querySelectorAll('.subcategory-tag');
    console.log('Found', tags.length, 'tag elements');
    
    tags.forEach(tag => {
        tag.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Tag clicked:', this.textContent);
            
            const tagText = this.textContent;
            const tagClass = this.className.split(' ').find(cls => cls.startsWith('tag-'));
            
            // Toggle active state
            this.classList.toggle('tag-active');
            
            // Filter posts by tag
            filterPostsByTag(tagText, tagClass);
        });
        
        // Add tooltip on hover
        tag.addEventListener('mouseenter', function() {
            this.title = `Click to filter by ${this.textContent}`;
        });
    });
    
    // Add tag filter button functionality
    const filterButtons = document.querySelectorAll('.tag-filter-btn');
    console.log('Found', filterButtons.length, 'filter buttons');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tagType = this.getAttribute('data-tag');
            console.log('Filter button clicked:', tagType);
            
            // Update active state
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Filter posts
            if (tagType === 'all') {
                showAllPosts();
            } else {
                filterPostsByTagType(tagType);
            }
        });
    });
    
    // Add tag filter functionality
    function filterPostsByTag(tagText, tagClass) {
        const allPosts = document.querySelectorAll('.post-list-with-tags li');
        const activeTags = document.querySelectorAll('.subcategory-tag.tag-active');
        
        console.log('Filtering posts by tag:', tagText, 'Active tags:', activeTags.length);
        
        if (activeTags.length === 0) {
            // Show all posts if no tags are active
            allPosts.forEach(post => {
                post.style.display = 'flex';
                post.style.opacity = '1';
            });
        } else {
            // Filter posts based on active tags
            allPosts.forEach(post => {
                const postTags = post.querySelectorAll('.subcategory-tag');
                let shouldShow = false;
                
                activeTags.forEach(activeTag => {
                    postTags.forEach(postTag => {
                        if (postTag.textContent === activeTag.textContent) {
                            shouldShow = true;
                        }
                    });
                });
                
                if (shouldShow) {
                    post.style.display = 'flex';
                    post.style.opacity = '1';
                } else {
                    post.style.display = 'none';
                    post.style.opacity = '0.3';
                }
            });
        }
    }
    
    // Filter posts by tag type (for filter buttons)
    function filterPostsByTagType(tagType) {
        const allPosts = document.querySelectorAll('.post-list-with-tags li');
        console.log('Filtering posts by tag type:', tagType, 'Total posts:', allPosts.length);
        
        allPosts.forEach(post => {
            const postTags = post.querySelectorAll('.subcategory-tag');
            let shouldShow = false;
            
            postTags.forEach(postTag => {
                const postTagClass = postTag.className.split(' ').find(cls => cls.startsWith('tag-'));
                if (postTagClass === `tag-${tagType}`) {
                    shouldShow = true;
                }
            });
            
            if (shouldShow) {
                post.style.display = 'flex';
                post.style.opacity = '1';
            } else {
                post.style.display = 'none';
                post.style.opacity = '0.3';
            }
        });
    }
    
    // Show all posts
    function showAllPosts() {
        const allPosts = document.querySelectorAll('.post-list-with-tags li');
        console.log('Showing all posts:', allPosts.length);
        
        allPosts.forEach(post => {
            post.style.display = 'flex';
            post.style.opacity = '1';
        });
        
        // Remove active state from individual tags
        tags.forEach(tag => tag.classList.remove('tag-active'));
    }
    
    // Add smooth animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'fadeInUp 0.6s ease-out forwards';
            }
        });
    }, observerOptions);
    
    // Observe all post list items
    document.querySelectorAll('.post-list-with-tags li').forEach(item => {
        observer.observe(item);
    });
    
    console.log('Tag interactions initialized successfully');
});
