create database MR; #mr=movie recommendation
use MR;
create table users(
	id int primary key,
    name varchar(100) not null,
    email varchar(50) not null unique,
    password varchar(100) not null,
    gender Enum('male' , 'female', 'others') not null,
    age int,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

create table movies(
	id int primary key,
    name varchar(200),
    poster varchar(200),
    genre varchar(50),
    industry varchar(100),
    director varchar(100),
    cast varchar(200),
    rating decimal(3,1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
create table user_searches(
	id int auto_increment primary key, 
	user_id int not null,
    searches varchar(100),
    foreign key (user_id) references users(id) ON DELETE CASCADE,
    searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
create table watch_history(
	id int auto_increment primary key,
	user_id int not null,
    movie_id int not null,
    foreign key (user_id) references users(id) ON DELETE CASCADE,
    foreign key (movie_id) references movies(id) ON DELETE CASCADE,
    watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
create table likes(
	id int auto_increment primary key,
    user_id int not null,
    movie_id int not null unique,
    foreign key (user_id) references users(id) ON DELETE CASCADE,
    foreign key (movie_id) references movies(id) ON DELETE CASCADE,
    liked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
create table clicks(
	id int auto_increment primary key,
    user_id int not null,
    movie_id int not null,
    foreign key (user_id) references users(id) ON DELETE CASCADE,
    foreign key (movie_id) references movies(id) ON DELETE CASCADE,
    clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    
alter table movies add column (embeddings varchar(500));
ALTER TABLE movies
MODIFY COLUMN director VARCHAR(255);
ALTER TABLE movies
MODIFY COLUMN genre VARCHAR(255);
ALTER TABLE movies
MODIFY COLUMN embeddings json;
 
select * from movies;